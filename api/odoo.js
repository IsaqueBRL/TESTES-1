export default async function handler(req, res) {
    // Configuração de CORS para permitir requisições sem bloqueio no frontend
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

        // AÇÃO: Criar Nova Venda / Fatura
        if (action === "create_sale") {
            const newInvoiceId = await execute("account.move", "create", [{
                move_type: "out_invoice"
            }]);
            return res.status(200).json({ success: true, id: newInvoiceId });
        }

        // AÇÃO: Excluir Fatura (somente faturas rascunho/provisórias sem número)
        if (action === "delete_sale") {
            const { order_id } = body;
            if (!order_id) {
                return res.status(400).json({ error: "ID da fatura é obrigatório." });
            }
            await execute("account.move", "unlink", [[Number(order_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: Buscar Parceiros (Clientes)
        if (action === "search_partners") {
            const query = body.query || "";
            const domain = query ? [["name", "ilike", query]] : [];
            const result = await execute("res.partner", "search_read", [domain], {
                fields: ["id", "name", "email", "phone"],
                limit: 20
            });
            return res.status(200).json({ partners: result || [] });
        }

        // AÇÃO: Criar Novo Parceiro (Cliente) no Odoo
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

        // AÇÃO: Buscar Estoque (stock.quant)
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

        // AÇÃO: Buscar Faturas de Vendas
        if (action === "get_sales") {
            const query = body.query || "";
            const domain = [["move_type", "=", "out_invoice"]];
            if (query) {
                domain.push('|', ['name', 'ilike', query], ['partner_id.name', 'ilike', query]);
            }

            const result = await execute("account.move", "search_read", [domain], {
                fields: ["id", "name", "partner_id", "amount_total", "state"],
                order: "id desc",
                limit: 100
            });
            return res.status(200).json({ result: result || [] });
        }

        // AÇÃO: Detalhes de uma Fatura
        if (action === "get_sale_detail") {
            const { order_id } = body;
            const invoices = await execute("account.move", "search_read", [[["id", "=", order_id]]], {
                fields: ["id", "name", "partner_id", "invoice_payment_term_id", "invoice_line_ids", "state"]
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

        // AÇÃO: Atualizar / Adicionar Linhas na Fatura (Com opção de apenas salvar ou lançar)
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
                    // Atualiza linha existente
                    await execute("account.move.line", "write", [[Number(l.id)], {
                        product_id: Number(l.product_id),
                        quantity: Number(l.qty),
                        price_unit: Number(l.price)
                    }]);
                } else if (l.product_id) {
                    // Cria nova linha no Odoo vinculada a esta fatura
                    await execute("account.move.line", "create", [{
                        move_id: Number(order_id),
                        product_id: Number(l.product_id),
                        quantity: Number(l.qty),
                        price_unit: Number(l.price)
                    }]);
                }
            }

            // Apenas lança a fatura se explicitamente solicitado
            if (post_invoice) {
                await execute("account.move", "action_post", [[Number(order_id)]]);
            }

            return res.status(200).json({ success: true });
        }

        // AÇÃO: Alterar Status
        if (action === "toggle_lock_sale") {
            const { order_id, lock } = body;
            if (!lock) {
                await execute("account.move", "button_draft", [[Number(order_id)]]);
            } else {
                await execute("account.move", "action_post", [[Number(order_id)]]);
            }
            return res.status(200).json({ success: true });
        }

        // AÇÃO PADRÃO / BUSCAR PRODUTOS (product.template)
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
