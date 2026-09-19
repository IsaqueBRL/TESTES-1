export default async function handler(req, res) {
    const ODOO_URL = "https://deuris-candy-2.odoo.com/jsonrpc";
    const ODOO_DB = "deuris-candy-2";
    const ODOO_USER = "isaquemoises14@gmail.com";
    const ODOO_API_KEY = "0757a6c247886172bff32acdceb0122735bb3278";

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = body.action || "search";

    try {
        // Autenticação no Odoo
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

        // AÇÃO: Buscar Categorias
        if (action === "get_categories") {
            const result = await execute("product.category", "search_read", [[]], { fields: ["id", "name"] });
            return res.status(200).json({ categories: result || [] });
        }

        // AÇÃO: Buscar Vendas (Ajustado para retornar todas as vendas/cotações)
        if (action === "get_sales") {
            const query = body.query || "";
            const domain = query ? ['|', ['name', 'ilike', query], ['partner_id.name', 'ilike', query]] : [];
            const result = await execute("sale.order", "search_read", [domain], {
                fields: ["id", "name", "partner_id", "amount_total", "state"],
                order: "id desc",
                limit: 100
            });
            return res.status(200).json({ result: result || [] });
        }

        // AÇÃO: Dados para Nova Venda
        if (action === "get_new_sale_data") {
            const partners = await execute("res.partner", "search_read", [[]], { fields: ["id", "name"], limit: 100 });
            const paymentTerms = await execute("account.payment.term", "search_read", [[]], { fields: ["id", "name"] });
            const products = await execute("product.product", "search_read", [[["sale_ok", "=", true]]], { fields: ["id", "display_name", "list_price"] });
            return res.status(200).json({ partners: partners || [], paymentTerms: paymentTerms || [], products: products || [] });
        }

        // AÇÃO: Criar e Confirmar Nova Venda
        if (action === "create_sale") {
            const { partner_id, payment_term_id, lines } = body;
            const lineCommands = lines.map(l => [0, 0, {
                product_id: Number(l.product_id),
                product_uom_qty: Number(l.qty),
                price_unit: Number(l.price)
            }]);

            const newOrderId = await execute("sale.order", "create", [{
                partner_id: Number(partner_id),
                payment_term_id: payment_term_id ? Number(payment_term_id) : false,
                order_line: lineCommands
            }]);

            // Confirma o pedido automaticamente
            await execute("sale.order", "action_confirm", [[newOrderId]]);
            const orderInfo = await execute("sale.order", "search_read", [[["id", "=", newOrderId]]], { fields: ["name"] });

            return res.status(200).json({ success: true, id: newOrderId, name: orderInfo[0]?.name || newOrderId });
        }

        // AÇÃO: Detalhes de uma Venda Específica
        if (action === "get_sale_detail") {
            const { order_id } = body;
            const orders = await execute("sale.order", "search_read", [[["id", "=", order_id]]], {
                fields: ["id", "name", "partner_id", "payment_term_id", "order_line", "state"]
            });
            if (!orders || orders.length === 0) return res.status(404).json({ error: "Pedido não encontrado." });

            const order = orders[0];
            const lines = await execute("sale.order.line", "search_read", [[["id", "in", order.order_line]]], {
                fields: ["id", "product_id", "product_uom_qty", "price_unit", "price_subtotal"]
            });
            const paymentTerms = await execute("account.payment.term", "search_read", [[]], { fields: ["id", "name"] });
            const products = await execute("product.product", "search_read", [[["sale_ok", "=", true]]], { fields: ["id", "display_name", "list_price"] });

            return res.status(200).json({ order, lines: lines || [], payment_terms: paymentTerms || [], products: products || [] });
        }

        // AÇÃO: Atualizar e Bloquear Pedido Existente
        if (action === "update_sale") {
            const { order_id, payment_term_id, lines } = body;
            await execute("sale.order", "write", [[Number(order_id)], {
                payment_term_id: payment_term_id ? Number(payment_term_id) : false
            }]);

            for (const l of lines) {
                if (l.id) {
                    await execute("sale.order.line", "write", [[Number(l.id)], {
                        product_id: Number(l.product_id),
                        product_uom_qty: Number(l.qty),
                        price_unit: Number(l.price)
                    }]);
                }
            }
            return res.status(200).json({ success: true });
        }

        // AÇÃO: Travar/Destravar Pedido
        if (action === "toggle_lock_sale") {
            const { order_id, lock } = body;
            const method = lock ? "action_lock" : "action_unlock";
            await execute("sale.order", method, [[Number(order_id)]]);
            return res.status(200).json({ success: true });
        }

        // AÇÃO: Buscar Estoque Detalhado (stock.quant)
        if (action === "get_stock") {
            const query = body.query || "";
            const domain = [["location_id.usage", "=", "internal"], ["quantity", ">", 0]];
            if (query) domain.push(["product_id.name", "ilike", query]);

            const result = await execute("stock.quant", "search_read", [domain], {
                fields: ["id", "location_id", "product_id", "quantity"],
                limit: 100
            });
            return res.status(200).json({ result: result || [] });
        }

        // AÇÃO: Atualizar Produto
        if (action === "update") {
            const { id, name, list_price, standard_price, categ_id } = body;
            if (!id) return res.status(400).json({ error: "ID do produto é obrigatório." });

            const templateData = {};
            if (list_price !== undefined) templateData.list_price = parseFloat(list_price) || 0.0;
            if (standard_price !== undefined) templateData.standard_price = parseFloat(standard_price) || 0.0;
            if (name) templateData.name = String(name).trim();
            if (categ_id) templateData.categ_id = Number(categ_id);

            await execute("product.template", "write", [[Number(id)], templateData], { context: { lang: "pt_BR" } });
            return res.status(200).json({ success: true, message: "Produto atualizado com sucesso!" });
        }

        // AÇÃO PADRÃO: Pesquisar Produtos
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
