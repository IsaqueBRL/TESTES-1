export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const ODOO_URL = "https://deuris-candy-2.odoo.com/jsonrpc";
    const ODOO_DB = "deuris-candy-2";
    const ODOO_USER = "isaquemoises14@gmail.com";
    const ODOO_API_KEY = "0757a6c247886172bff32acdceb0122735bb3278";

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = body.action || "get_products";

    try {
        const authRes = await fetch(ODOO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "common",
                    method: "authenticate",
                    args: [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}]
                },
                id: Date.now()
            })
        });

        const authData = await authRes.json();
        const uid = authData.result;

        if (!uid) {
            return res.status(401).json({ error: "Falha na autenticação com o Odoo." });
        }

        const execute = (model, method, args, kwargs = {}) => {
            return fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs]
                    },
                    id: Date.now()
                })
            }).then(r => r.json()).then(d => {
                if (d.error) {
                    const errData = d.error.data || {};
                    const msg = errData.message || errData.debug || d.error.message || `Erro desconhecido do Odoo ao chamar ${model}.${method}`;
                    throw new Error(msg);
                }
                return d.result;
            });
        };

        // Encontra o tipo de operação de "Transferência Interna" correspondente ao local de origem
        // (mesma lógica que o próprio Odoo usa para preencher "Tipo de operação" automaticamente)
        const resolveInternalPickingType = async (locationId) => {
            const types = await execute("stock.picking.type", "search_read", [[["code", "=", "internal"]]], {
                fields: ["id", "name", "default_location_src_id", "default_location_dest_id"]
            });
            if (!types || types.length === 0) return null;
            if (locationId) {
                const match = types.find(t => Array.isArray(t.default_location_src_id) && t.default_location_src_id[0] === Number(locationId));
                if (match) return match;
            }
            return types[0];
        };

        // Força todas as linhas de produto de uma fatura a usarem sempre a mesma conta contábil,
        // sem que isso precise aparecer/ser escolhido na tela do nosso site
        const FORCED_INVOICE_ACCOUNT_CODE = "3.01.01.01.01.04";
        let forcedAccountIdCache = null;
        const resolveForcedAccountId = async () => {
            if (forcedAccountIdCache) return forcedAccountIdCache;
            const accs = await execute("account.account", "search_read", [[["code", "=", FORCED_INVOICE_ACCOUNT_CODE]]], { fields: ["id"] });
            if (accs && accs.length > 0) {
                forcedAccountIdCache = accs[0].id;
                return forcedAccountIdCache;
            }
            return null;
        };
        const applyForcedAccountToInvoice = async (invoiceId) => {
            const accountId = await resolveForcedAccountId();
            if (!accountId) return;
            const lines = await execute("account.move.line", "search_read", [[["move_id", "=", invoiceId], ["display_type", "=", "product"]]], { fields: ["id"] });
            const ids = (lines || []).map(l => l.id);
            if (ids.length > 0) {
                await execute("account.move.line", "write", [ids, { account_id: accountId }]);
            }
        };

        // Quando _create_invoices() não gera nenhuma fatura (sem lançar erro), busca o motivo
        // olhando quanto já foi pedido/entregue/faturado em cada linha, para explicar na mensagem
        const diagnosticarPedidoSemFatura = async (orderId) => {
            try {
                const orders = await execute("sale.order", "search_read", [[["id", "=", Number(orderId)]]], { fields: ["invoice_status"] });
                const statusLabels = { no: "nada a faturar", to_invoice: "a faturar", invoiced: "já totalmente faturado", upselling: "faturamento adicional disponível" };
                const orderStatus = orders && orders[0] ? (statusLabels[orders[0].invoice_status] || orders[0].invoice_status) : "desconhecido";

                const lines = await execute("sale.order.line", "search_read", [[["order_id", "=", Number(orderId)], ["display_type", "=", false]]], {
                    fields: ["product_id", "product_uom_qty", "qty_delivered", "qty_invoiced"]
                });
                const linesTxt = (lines || []).map(l => {
                    const name = Array.isArray(l.product_id) ? l.product_id[1] : String(l.product_id);
                    return `${name} (pedido: ${l.product_uom_qty}, entregue: ${l.qty_delivered}, já faturado: ${l.qty_invoiced})`;
                }).join("; ");

                return ` Status de faturamento do pedido: ${orderStatus}. ${linesTxt}`;
            } catch (e) {
                return "";
            }
        };

        // AÇÃO: BUSCAR PAGAMENTOS DA FATURA
        if (action === "get_invoice_payments") {
            const { order_id } = body;
            if (!order_id) return res.status(400).json({ error: "ID da fatura é obrigatório." });

            const invoice = await execute("account.move", "read", [[Number(order_id)]], {
                fields: ["invoice_payments_widget"]
            });

            let paymentIds = [];
            if (invoice && invoice[0] && invoice[0].invoice_payments_widget) {
                const widgetData = typeof invoice[0].invoice_payments_widget === 'string' 
                    ? JSON.parse(invoice[0].invoice_payments_widget) 
                    : invoice[0].invoice_payments_widget;

                if (widgetData && widgetData.content) {
                    paymentIds = widgetData.content.map(p => p.account_payment_id).filter(Boolean);
                }
            }

            if (paymentIds.length === 0) {
                const paymentsFound = await execute("account.payment", "search_read", [[["ref", "ilike", order_id]]], {
                    fields: ["id", "name", "amount", "date", "state", "journal_id", "partner_id"]
                });
                return res.status(200).json({ payments: paymentsFound || [] });
            }

            const payments = await execute("account.payment", "search_read", [[["id", "in", paymentIds]]], {
                fields: ["id", "name", "amount", "date", "state", "journal_id", "partner_id"]
            });

            return res.status(200).json({ payments: payments || [] });
        }

        // AÇÃO: MUDAR PAGAMENTO PARA PROVISÓRIO (VOLTAR PARA PROVISÓRIO)
        if (action === "unpost_payment") {
            const { payment_id } = body;
            if (!payment_id) return res.status(400).json({ error: "ID do pagamento é obrigatório." });

            await execute("account.payment", "action_draft", [[Number(payment_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: LANÇAR / CONFIRMAR PAGAMENTO NO ODOO
        if (action === "post_payment") {
            const { payment_id } = body;
            if (!payment_id) return res.status(400).json({ error: "ID do pagamento é obrigatório." });

            await execute("account.payment", "action_post", [[Number(payment_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: ATUALIZAR PAGAMENTO
        if (action === "update_payment") {
            const { payment_id, journal_id, amount, date } = body;
            if (!payment_id) return res.status(400).json({ error: "ID do pagamento é obrigatório." });

            const writeData = {};
            if (journal_id) writeData.journal_id = Number(journal_id);
            if (amount !== undefined) writeData.amount = Number(amount);
            if (date) writeData.date = date;

            await execute("account.payment", "write", [[Number(payment_id)], writeData]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: EXCLUIR PAGAMENTO (APENAS SE ESTIVER EM PROVISÓRIO)
        if (action === "delete_payment") {
            const { payment_id } = body;
            if (!payment_id) return res.status(400).json({ error: "ID do pagamento é obrigatório." });

            await execute("account.payment", "unlink", [[Number(payment_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: BUSCAR DIÁRIOS / CONTAS DE PAGAMENTO (BANCO/CAIXA)
        if (action === "get_payment_journals") {
            const journals = await execute("account.journal", "search_read", [[["type", "in", ["bank", "cash"]]]], {
                fields: ["id", "name", "type"]
            });
            return res.status(200).json({ result: journals || [] });
        }

        // AÇÃO: REGISTRAR PAGAMENTO DA FATURA
        if (action === "register_payment") {
            const { order_id, journal_id, amount, payment_date } = body;
            if (!order_id || !journal_id || !amount) {
                return res.status(400).json({ error: "Campos obrigatórios não informados." });
            }

            const wizardId = await execute("account.payment.register", "create", [{
                journal_id: Number(journal_id),
                amount: Number(amount),
                payment_date: payment_date || false
            }], {
                context: {
                    active_model: "account.move",
                    active_ids: [Number(order_id)]
                }
            });

            if (wizardId) {
                await execute("account.payment.register", "action_create_payments", [[wizardId]], {
                    context: {
                        active_model: "account.move",
                        active_ids: [Number(order_id)]
                    }
                });
                return res.status(200).json({ success: true });
            } else {
                return res.status(500).json({ error: "Não foi possível gerar o pagamento no Odoo." });
            }
        }

        // AÇÃO: BUSCAR CONTAS FINANCEIRAS E SALDO
        if (action === "get_financial_accounts") {
            const query = body.query || "";
            const domain = [["account_type", "in", ["asset_cash", "bank_and_cash"]]];
            
            if (query) {
                domain.push('|', ['name', 'ilike', query], ['code', 'ilike', query]);
            }

            let accounts = await execute("account.account", "search_read", [domain], {
                fields: ["id", "code", "name", "account_type", "current_balance"],
                limit: 100
            });

            if (!accounts || accounts.length === 0) {
                const altDomain = query ? ['|', ['name', 'ilike', query], ['code', 'ilike', query]] : [];
                accounts = await execute("account.account", "search_read", [altDomain], {
                    fields: ["id", "code", "name", "account_type", "current_balance"],
                    limit: 100
                });
            }

            const formattedAccounts = await Promise.all((accounts || []).map(async (acc) => {
                let balance = acc.current_balance ?? 0;
                try {
                    const lines = await execute("account.move.line", "read_group", [
                        [["account_id", "=", acc.id], ["parent_state", "=", "posted"]]
                    ], {
                        groupby: ["account_id"],
                        fields: ["balance"]
                    });

                    if (lines && lines.length > 0) {
                        balance = lines[0].balance ?? balance;
                    }
                } catch (e) {}

                return {
                    id: acc.id,
                    code: acc.code || "-",
                    name: acc.name || "-",
                    type: acc.account_type || "-",
                    balance: balance
                };
            }));

            return res.status(200).json({ result: formattedAccounts });
        }

        // AÇÃO: DADOS DE APOIO PARA MONTAR UM NOVO PEDIDO DE VENDA (CONDIÇÕES DE PAGAMENTO, PRODUTOS, ARMAZÉNS)
        if (action === "get_sale_form_data") {
            const [paymentTerms, products, warehouses] = await Promise.all([
                execute("account.payment.term", "search_read", [[]], { fields: ["id", "name"] }).catch(() => []),
                execute("product.product", "search_read", [[["sale_ok", "=", true]]], { fields: ["id", "display_name", "list_price"] }).catch(() => []),
                execute("stock.warehouse", "search_read", [[]], { fields: ["id", "name", "code"] }).catch(() => [])
            ]);
            return res.status(200).json({ payment_terms: paymentTerms || [], products: products || [], warehouses: warehouses || [] });
        }

        // AÇÃO: BUSCAR ARMAZÉNS (LOCAIS DE ESTOQUE PARA VENDA)
        if (action === "get_warehouses") {
            const warehouses = await execute("stock.warehouse", "search_read", [[]], {
                fields: ["id", "name", "code"]
            });
            return res.status(200).json({ result: warehouses || [] });
        }

        // AÇÃO: ATUALIZAR PRODUTO
        if (action === "update_product") {
            const { product_id, name, list_price, standard_price } = body;
            if (!product_id) return res.status(400).json({ error: "ID do produto é obrigatório." });

            const writeData = {};
            if (name) writeData.name = name;
            if (list_price !== undefined) writeData.list_price = Number(list_price);
            if (standard_price !== undefined) writeData.standard_price = Number(standard_price);

            await execute("product.template", "write", [[Number(product_id)], writeData]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: EXCLUIR PEDIDO DE VENDA (SOMENTE ORÇAMENTO)
        if (action === "delete_sale_order") {
            const { order_id } = body;
            if (!order_id) {
                return res.status(400).json({ error: "ID do pedido é obrigatório." });
            }
            await execute("sale.order", "unlink", [[Number(order_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: CANCELAR PEDIDO DE VENDA
        if (action === "cancel_sale_order") {
            const { order_id } = body;
            if (!order_id) {
                return res.status(400).json({ error: "ID do pedido é obrigatório." });
            }
            await execute("sale.order", "action_cancel", [[Number(order_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: REABRIR PEDIDO CANCELADO/CONFIRMADO COMO ORÇAMENTO (EDITÁVEL)
        if (action === "reopen_sale_order") {
            const { order_id } = body;
            if (!order_id) {
                return res.status(400).json({ error: "ID do pedido é obrigatório." });
            }
            try {
                await execute("sale.order", "action_cancel", [[Number(order_id)]]);
            } catch (e) { /* já pode estar cancelado */ }
            await execute("sale.order", "action_draft", [[Number(order_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: CRIAR/ATUALIZAR PEDIDO DE VENDA (E, OPCIONALMENTE, CONFIRMAR + BAIXAR ESTOQUE + FATURAR)
        if (action === "save_sale_order") {
            const { order_id, partner_id, payment_term_id, warehouse_id, lines, confirm, removed_line_ids } = body;

            if (!partner_id) return res.status(400).json({ error: "Selecione um cliente para o pedido." });
            const validLines = (lines || []).filter(l => l.product_id);
            if (validLines.length === 0) return res.status(400).json({ error: "Adicione ao menos um produto ao pedido." });

            let orderId = order_id ? Number(order_id) : null;

            const headerData = {
                partner_id: Number(partner_id),
                payment_term_id: payment_term_id ? Number(payment_term_id) : false
            };
            if (warehouse_id) headerData.warehouse_id = Number(warehouse_id);

            if (!orderId) {
                headerData.order_line = validLines.map(l => [0, 0, {
                    product_id: Number(l.product_id),
                    product_uom_qty: Number(l.qty),
                    price_unit: Number(l.price)
                }]);
                orderId = await execute("sale.order", "create", [headerData]);
            } else {
                await execute("sale.order", "write", [[orderId], headerData]);

                for (const rid of (removed_line_ids || [])) {
                    await execute("sale.order.line", "unlink", [[Number(rid)]]).catch(() => {});
                }

                for (const l of validLines) {
                    if (l.id) {
                        await execute("sale.order.line", "write", [[Number(l.id)], {
                            product_id: Number(l.product_id),
                            product_uom_qty: Number(l.qty),
                            price_unit: Number(l.price)
                        }]);
                    } else {
                        await execute("sale.order.line", "create", [{
                            order_id: orderId,
                            product_id: Number(l.product_id),
                            product_uom_qty: Number(l.qty),
                            price_unit: Number(l.price)
                        }]);
                    }
                }
            }

            let warnings = [];
            let invoiceId = null;

            if (confirm) {
                try {
                    await execute("sale.order", "action_confirm", [[orderId]]);
                } catch (e) {
                    return res.status(200).json({ success: true, id: orderId, warnings: ["Pedido salvo, mas não foi possível confirmá-lo: " + e.message] });
                }

                // Tenta validar a(s) entrega(s) geradas, definindo a quantidade feita = quantidade pedida,
                // para baixar de fato o estoque do local/armazém escolhido
                try {
                    const pickings = await execute("stock.picking", "search_read", [[["sale_id", "=", orderId], ["state", "not in", ["done", "cancel"]]]], {
                        fields: ["id"]
                    });
                    for (const p of (pickings || [])) {
                        try {
                            const moves = await execute("stock.move", "search_read", [[["picking_id", "=", p.id]]], { fields: ["id", "product_uom_qty"] });
                            for (const mv of (moves || [])) {
                                try {
                                    await execute("stock.move", "write", [[mv.id], { quantity: mv.product_uom_qty }]);
                                } catch (e2) {
                                    await execute("stock.move", "write", [[mv.id], { quantity_done: mv.product_uom_qty }]).catch(() => {});
                                }
                            }
                            await execute("stock.picking", "button_validate", [[p.id]]);
                        } catch (e) {
                            warnings.push("Pedido confirmado, mas a entrega #" + p.id + " não pôde ser concluída automaticamente. Finalize-a no Odoo para baixar o estoque.");
                        }
                    }
                } catch (e) {
                    warnings.push("Não foi possível localizar a entrega gerada pelo pedido.");
                }

                // Gera a fatura em rascunho (equivalente a escolher "Fatura normal" e "Criar Rascunho" no Odoo).
                // A fatura NÃO é lançada automaticamente - isso é feito depois, na tela de revisão da fatura.
                try {
                    const invoiceIds = await execute("sale.order", "_create_invoices", [[orderId]]);
                    if (invoiceIds && invoiceIds.length > 0) {
                        invoiceId = invoiceIds[0];
                        await applyForcedAccountToInvoice(invoiceId);
                    } else {
                        warnings.push("Pedido confirmado, mas ainda não havia nada a faturar. Use o botão \"Gerar Fatura\" no pedido depois de confirmar a entrega.");
                    }
                } catch (e) {
                    warnings.push("Pedido confirmado, mas não foi possível gerar a fatura automaticamente: " + e.message);
                }
            }

            return res.status(200).json({ success: true, id: orderId, invoice_id: invoiceId, warnings });
        }

        // AÇÃO: GERAR A FATURA (RASCUNHO) DE UM PEDIDO JÁ CONFIRMADO (CASO AINDA NÃO TENHA FATURA)
        if (action === "create_sale_invoice") {
            const { order_id } = body;
            if (!order_id) return res.status(400).json({ error: "ID do pedido é obrigatório." });

            try {
                const invoiceIds = await execute("sale.order", "_create_invoices", [[Number(order_id)]]);
                if (!invoiceIds || invoiceIds.length === 0) {
                    const diag = await diagnosticarPedidoSemFatura(order_id);
                    return res.status(400).json({ error: "Não foi possível gerar a fatura para este pedido." + diag });
                }
                await applyForcedAccountToInvoice(invoiceIds[0]);
                return res.status(200).json({ success: true, invoice_id: invoiceIds[0] });
            } catch (e) {
                return res.status(500).json({ error: "Erro ao gerar a fatura: " + e.message });
            }
        }

        // AÇÃO: DETALHES DE UMA FATURA (TELA DE REVISÃO ANTES DE LANÇAR)
        if (action === "get_invoice_detail") {
            const { invoice_id } = body;
            if (!invoice_id) return res.status(400).json({ error: "ID da fatura é obrigatório." });

            const invoices = await execute("account.move", "search_read", [[["id", "=", Number(invoice_id)]]], {
                fields: ["id", "name", "partner_id", "invoice_payment_term_id", "invoice_date", "state", "payment_state", "amount_total", "invoice_line_ids"]
            });
            if (!invoices || invoices.length === 0) return res.status(404).json({ error: "Fatura não encontrada." });
            const invoice = invoices[0];

            const lines = await execute("account.move.line", "search_read", [[["id", "in", invoice.invoice_line_ids], ["display_type", "=", "product"]]], {
                fields: ["id", "product_id", "quantity", "discount", "price_unit", "price_subtotal", "price_total"]
            }).catch(() => []);

            return res.status(200).json({ invoice, lines: lines || [] });
        }

        // AÇÃO: ATUALIZAR DATA/DESCONTO DA FATURA (SOMENTE ENQUANTO ELA ESTIVER EM RASCUNHO)
        if (action === "update_invoice_detail") {
            const { invoice_id, invoice_date, lines } = body;
            if (!invoice_id) return res.status(400).json({ error: "ID da fatura é obrigatório." });

            if (invoice_date) {
                await execute("account.move", "write", [[Number(invoice_id)], { invoice_date }]);
            }

            for (const l of (lines || [])) {
                if (!l.id) continue;
                await execute("account.move.line", "write", [[Number(l.id)], { discount: Number(l.discount) || 0 }]);
            }

            await applyForcedAccountToInvoice(Number(invoice_id));

            return res.status(200).json({ success: true });
        }

        // AÇÃO: LANÇAR (CONFIRMAR) A FATURA
        if (action === "post_sale_invoice") {
            const { invoice_id } = body;
            if (!invoice_id) return res.status(400).json({ error: "ID da fatura é obrigatório." });
            try {
                await execute("account.move", "action_post", [[Number(invoice_id)]]);
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: "Erro ao lançar a fatura: " + e.message });
            }
        }

        // AÇÃO: BUSCAR PARCEIROS
        if (action === "search_partners") {
            const query = body.query || "";
            const domain = query ? [["name", "ilike", query]] : [];
            const result = await execute("res.partner", "search_read", [domain], {
                fields: ["id", "name", "email", "phone"],
                limit: 20
            });
            return res.status(200).json({ partners: result || [] });
        }

        // AÇÃO: CRIAR PARCEIRO
        if (action === "create_partner") {
            const { name, email, phone } = body;
            if (!name || !name.trim()) {
                return res.status(400).json({ error: "Nome do parceiro é obrigatório." });
            }

            const newPartnerId = await execute("res.partner", "create", [{
                name: name.trim(),
                email: email ? email.trim() : false,
                phone: phone ? phone.trim() : false,
                customer_rank: 1
            }]);

            return res.status(200).json({ success: true, id: newPartnerId, name: name.trim() });
        }

        // AÇÃO: BUSCAR ESTOQUE
        if (action === "get_stock") {
            const query = body.query || "";
            const domain = [["quantity", ">", 0]];
            if (query) domain.push(["product_id.name", "ilike", query]);

            const result = await execute("stock.quant", "search_read", [domain], {
                fields: ["id", "location_id", "product_id", "quantity"],
                limit: 100
            });
            return res.status(200).json({ result: result || [] });
        }

        // AÇÃO: BUSCAR PEDIDOS DE VENDAS
        if (action === "get_sales") {
            const query = body.query || "";
            const domain = [];
            if (query) {
                domain.push('|', ['name', 'ilike', query], ['partner_id.name', 'ilike', query]);
            }

            const orders = await execute("sale.order", "search_read", [domain], {
                fields: ["id", "name", "partner_id", "amount_total", "state", "invoice_status", "invoice_ids", "warehouse_id"],
                order: "id desc",
                limit: 100
            });

            // Busca em lote o status de pagamento das faturas ligadas a cada pedido
            const allInvoiceIds = [];
            (orders || []).forEach(o => (o.invoice_ids || []).forEach(id => allInvoiceIds.push(id)));

            let invoiceMap = {};
            if (allInvoiceIds.length > 0) {
                const invoices = await execute("account.move", "search_read", [[["id", "in", allInvoiceIds]]], {
                    fields: ["id", "payment_state", "state"]
                }).catch(() => []);
                (invoices || []).forEach(inv => { invoiceMap[inv.id] = inv; });
            }

            const result = (orders || []).map(o => {
                const invs = (o.invoice_ids || []).map(id => invoiceMap[id]).filter(Boolean);
                let paymentSummary = "nao_faturado";
                if (invs.length > 0) {
                    const allPaid = invs.every(i => i.payment_state === 'paid' || i.payment_state === 'in_payment');
                    paymentSummary = allPaid ? "pago" : "nao_pago";
                }
                return { ...o, payment_summary: paymentSummary };
            });

            return res.status(200).json({ result });
        }

        // AÇÃO: DETALHES DE UM PEDIDO DE VENDA
        if (action === "get_sale_detail") {
            const { order_id } = body;
            const orders = await execute("sale.order", "search_read", [[["id", "=", order_id]]], {
                fields: ["id", "name", "partner_id", "payment_term_id", "order_line", "state", "amount_total", "warehouse_id", "invoice_ids", "invoice_status"]
            });
            if (!orders || orders.length === 0) return res.status(404).json({ error: "Pedido de venda não encontrado." });

            const order = orders[0];

            // Cada consulta auxiliar roda isolada: se uma falhar (instabilidade pontual do Odoo),
            // não derruba a tela inteira - apenas volta vazia nesse campo específico.
            const [lines, partners, paymentTerms, products, warehouses, invoices] = await Promise.all([
                execute("sale.order.line", "search_read", [[["id", "in", order.order_line], ["display_type", "=", false]]], {
                    fields: ["id", "product_id", "product_uom_qty", "price_unit", "price_subtotal"]
                }).catch(() => []),
                execute("res.partner", "search_read", [[]], { fields: ["id", "name"], limit: 100 }).catch(() => []),
                execute("account.payment.term", "search_read", [[]], { fields: ["id", "name"] }).catch(() => []),
                execute("product.product", "search_read", [[["sale_ok", "=", true]]], { fields: ["id", "display_name", "list_price"] }).catch(() => []),
                execute("stock.warehouse", "search_read", [[]], { fields: ["id", "name"] }).catch(() => []),
                (order.invoice_ids && order.invoice_ids.length > 0)
                    ? execute("account.move", "search_read", [[["id", "in", order.invoice_ids]]], { fields: ["id", "name", "state", "payment_state", "amount_total"] }).catch(() => [])
                    : Promise.resolve([])
            ]);

            return res.status(200).json({ order, lines: lines || [], partners: partners || [], payment_terms: paymentTerms || [], products: products || [], warehouses: warehouses || [], invoices: invoices || [] });
        }

        // AÇÃO: BUSCAR LOCAIS DE ESTOQUE INTERNOS (PARA TRANSFERÊNCIAS)
        if (action === "get_locations") {
            const locations = await execute("stock.location", "search_read", [[["usage", "=", "internal"]]], {
                fields: ["id", "complete_name"],
                limit: 200
            });
            return res.status(200).json({ result: locations || [] });
        }

        // AÇÃO: BUSCAR TRANSFERÊNCIAS INTERNAS
        if (action === "get_transfers") {
            const query = body.query || "";
            const domain = [["picking_type_id.code", "=", "internal"]];
            if (query) domain.push(["name", "ilike", query]);

            const result = await execute("stock.picking", "search_read", [domain], {
                fields: ["id", "name", "location_id", "location_dest_id", "state"],
                order: "id desc",
                limit: 100
            });
            return res.status(200).json({ result: result || [] });
        }

        // AÇÃO: DETALHES DE UMA TRANSFERÊNCIA
        if (action === "get_transfer_detail") {
            const { order_id } = body;
            const pickings = await execute("stock.picking", "search_read", [[["id", "=", order_id]]], {
                fields: ["id", "name", "location_id", "location_dest_id", "state", "picking_type_id"]
            });
            if (!pickings || pickings.length === 0) return res.status(404).json({ error: "Transferência não encontrada." });

            const picking = pickings[0];
            const moves = await execute("stock.move", "search_read", [[["picking_id", "=", order_id]]], {
                fields: ["id", "product_id", "product_uom_qty"]
            });
            const locations = await execute("stock.location", "search_read", [[["usage", "=", "internal"]]], {
                fields: ["id", "complete_name"],
                limit: 200
            });
            const products = await execute("product.product", "search_read", [[["type", "!=", "service"]]], {
                fields: ["id", "display_name", "uom_id"],
                limit: 200
            });

            return res.status(200).json({ order: picking, lines: moves || [], locations: locations || [], products: products || [] });
        }

        // AÇÃO: CRIAR NOVA TRANSFERÊNCIA INTERNA
        if (action === "create_transfer") {
            const defaultType = await resolveInternalPickingType(null);
            if (!defaultType) {
                return res.status(400).json({ error: "Nenhum tipo de operação de Transferência Interna encontrado no Odoo." });
            }

            const newPickingId = await execute("stock.picking", "create", [{
                picking_type_id: defaultType.id,
                location_id: Array.isArray(defaultType.default_location_src_id) ? defaultType.default_location_src_id[0] : false,
                location_dest_id: Array.isArray(defaultType.default_location_dest_id) ? defaultType.default_location_dest_id[0] : false
            }]);

            return res.status(200).json({ success: true, id: newPickingId });
        }

        // AÇÃO: EXCLUIR TRANSFERÊNCIA (APENAS PERMITIDO EM RASCUNHO PELO PRÓPRIO ODOO)
        if (action === "delete_transfer") {
            const { order_id } = body;
            if (!order_id) return res.status(400).json({ error: "ID da transferência é obrigatório." });
            await execute("stock.picking", "unlink", [[Number(order_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: ATUALIZAR LOCAIS/ITENS DA TRANSFERÊNCIA E, OPCIONALMENTE, VALIDAR
        if (action === "update_transfer") {
            const { order_id, location_id, location_dest_id, lines, validate } = body;
            if (!order_id) return res.status(400).json({ error: "ID da transferência é obrigatório." });

            const writeData = {};
            if (location_id) writeData.location_id = Number(location_id);
            if (location_dest_id) writeData.location_dest_id = Number(location_dest_id);

            if (location_id) {
                const matchedType = await resolveInternalPickingType(location_id);
                if (matchedType) writeData.picking_type_id = matchedType.id;
            }

            if (Object.keys(writeData).length > 0) {
                await execute("stock.picking", "write", [[Number(order_id)], writeData]);

                const moveLocUpdate = {};
                if (writeData.location_id) moveLocUpdate.location_id = writeData.location_id;
                if (writeData.location_dest_id) moveLocUpdate.location_dest_id = writeData.location_dest_id;

                const existingMoveIds = (lines || []).filter(l => l.id).map(l => Number(l.id));
                if (Object.keys(moveLocUpdate).length > 0 && existingMoveIds.length > 0) {
                    await execute("stock.move", "write", [existingMoveIds, moveLocUpdate]);
                }
            }

            for (const l of (lines || [])) {
                if (!l.product_id) continue;

                if (l.id) {
                    await execute("stock.move", "write", [[Number(l.id)], {
                        product_id: Number(l.product_id),
                        product_uom_qty: Number(l.qty)
                    }]);
                } else {
                    const productInfo = await execute("product.product", "read", [[Number(l.product_id)]], {
                        fields: ["display_name", "uom_id"]
                    });
                    const prod = (productInfo && productInfo[0]) || {};

                    await execute("stock.move", "create", [{
                        picking_id: Number(order_id),
                        product_id: Number(l.product_id),
                        product_uom_qty: Number(l.qty),
                        name: prod.display_name || "Transferência Interna",
                        product_uom: Array.isArray(prod.uom_id) ? prod.uom_id[0] : false,
                        location_id: writeData.location_id || (location_id ? Number(location_id) : undefined),
                        location_dest_id: writeData.location_dest_id || (location_dest_id ? Number(location_dest_id) : undefined)
                    }]);
                }
            }

            if (validate) {
                await execute("stock.picking", "button_validate", [[Number(order_id)]]);
            }

            return res.status(200).json({ success: true });
        }

        // AÇÃO PADRÃO: PRODUTOS
        const query = body.query || "";
        const domain = query ? [["name", "ilike", query]] : [];
        const result = await execute("product.template", "search_read", [domain], {
            fields: ["id", "name", "list_price", "standard_price", "qty_available", "type", "categ_id"],
            limit: 100
        });

        const produtosFiltrados = (result || []).filter(prod => prod.type !== "service");
        return res.status(200).json({ result: produtosFiltrados });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
