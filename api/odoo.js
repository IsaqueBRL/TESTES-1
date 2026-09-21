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
            }).then(r => r.json()).then(d => d.result);
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

        // AÇÃO: CRIAR NOVA VENDA / FATURA
        if (action === "create_sale") {
            const newInvoiceId = await execute("account.move", "create", [{
                move_type: "out_invoice"
            }]);
            return res.status(200).json({ success: true, id: newInvoiceId });
        }

        // AÇÃO: EXCLUIR FATURA
        if (action === "delete_sale") {
            const { order_id } = body;
            if (!order_id) {
                return res.status(400).json({ error: "ID da fatura é obrigatório." });
            }
            await execute("account.move", "unlink", [[Number(order_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: CANCELAR FATURA
        if (action === "cancel_sale") {
            const { order_id } = body;
            if (!order_id) {
                return res.status(400).json({ error: "ID da fatura é obrigatório." });
            }
            await execute("account.move", "button_cancel", [[Number(order_id)]]);
            return res.status(200).json({ success: true });
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

        // AÇÃO: BUSCAR FATURAS DE VENDAS
        if (action === "get_sales") {
            const query = body.query || "";
            const domain = [["move_type", "=", "out_invoice"]];
            if (query) {
                domain.push('|', ['name', 'ilike', query], ['partner_id.name', 'ilike', query]);
            }

            const result = await execute("account.move", "search_read", [domain], {
                fields: ["id", "name", "partner_id", "amount_total", "state", "payment_state"],
                order: "id desc",
                limit: 100
            });
            return res.status(200).json({ result: result || [] });
        }

        // AÇÃO: DETALHES DE UMA FATURA
        if (action === "get_sale_detail") {
            const { order_id } = body;
            const invoices = await execute("account.move", "search_read", [[["id", "=", order_id]]], {
                fields: ["id", "name", "partner_id", "invoice_payment_term_id", "invoice_line_ids", "state", "payment_state", "amount_total"]
            });
            if (!invoices || invoices.length === 0) return res.status(404).json({ error: "Fatura não encontrada." });

            const invoice = invoices[0];
            const lines = await execute("account.move.line", "search_read", [[["id", "in", invoice.invoice_line_ids], ["display_type", "=", "product"]]], {
                fields: ["id", "product_id", "quantity", "price_unit", "price_subtotal"]
            });
            const partners = await execute("res.partner", "search_read", [[]], { fields: ["id", "name"], limit: 100 });
            const paymentTerms = await execute("account.payment.term", "search_read", [[]], { fields: ["id", "name"] });
            const products = await execute("product.product", "search_read", [[["sale_ok", "=", true]]], { fields: ["id", "display_name", "list_price"] });

            return res.status(200).json({ order: invoice, lines: lines || [], partners: partners || [], payment_terms: paymentTerms || [], products: products || [] });
        }

        // AÇÃO: ATUALIZAR LINHAS DA FATURA
        if (action === "update_sale") {
            const { order_id, partner_id, payment_term_id, lines, post_invoice } = body;
            
            const writeData = {
                invoice_payment_term_id: payment_term_id ? Number(payment_term_id) : false
            };
            if (partner_id) {
                writeData.partner_id = Number(partner_id);
            }

            await execute("account.move", "write", [[Number(order_id)], writeData]);

            for (const l of lines) {
                if (l.id) {
                    await execute("account.move.line", "write", [[Number(l.id)], {
                        product_id: Number(l.product_id),
                        quantity: Number(l.qty),
                        price_unit: Number(l.price)
                    }]);
                } else if (l.product_id) {
                    await execute("account.move.line", "create", [{
                        move_id: Number(order_id),
                        product_id: Number(l.product_id),
                        quantity: Number(l.qty),
                        price_unit: Number(l.price)
                    }]);
                }
            }

            if (post_invoice) {
                await execute("account.move", "action_post", [[Number(order_id)]]);
            }

            return res.status(200).json({ success: true });
        }

        // AÇÃO: ALTERAR STATUS
        if (action === "toggle_lock_sale") {
            const { order_id, lock } = body;
            if (!lock) {
                await execute("account.move", "button_draft", [[Number(order_id)]]);
            } else {
                await execute("account.move", "action_post", [[Number(order_id)]]);
            }
            return res.status(200).json({ success: true });
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
