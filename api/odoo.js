export default async function handler(req, res) {
    const ODOO_URL = "https://deuris-candy-2.odoo.com/jsonrpc";
    const ODOO_DB = "deuris-candy-2";
    const ODOO_USER = "isaquemoises14@gmail.com";
    const ODOO_API_KEY = "0757a6c247886172bff32acdceb0122735bb3278";

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = body.action || "search";

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

        // 1. BUSCAR CATEGORIAS
        if (action === "get_categories") {
            const catRes = await fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [
                            ODOO_DB, uid, ODOO_API_KEY,
                            "product.category", "search_read",
                            [[]],
                            { fields: ["id", "name"] }
                        ]
                    },
                    id: Date.now()
                })
            });

            const catData = await catRes.json();
            return res.status(200).json({ categories: catData.result || [] });
        }

        // 2. BUSCAR LISTA DE VENDAS
        if (action === "get_sales") {
            const query = body.query || "";
            const domain = [["state", "=", "sale"]];
            if (query) {
                domain.push("|", ["name", "ilike", query], ["partner_id.name", "ilike", query]);
            }

            const salesRes = await fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [
                            ODOO_DB, uid, ODOO_API_KEY,
                            "sale.order", "search_read",
                            [domain],
                            { 
                                fields: ["id", "name", "partner_id", "amount_total"], 
                                order: "id desc",
                                limit: 100 
                            }
                        ]
                    },
                    id: Date.now()
                })
            });

            const salesData = await salesRes.json();
            return res.status(200).json({ result: salesData.result || [] });
        }

        // 3. OBTER DETALHES DE UMA VENDA ESPECÍFICA
        if (action === "get_sale_detail") {
            const order_id = body.order_id;

            // Busca pedido
            const orderRes = await fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [
                            ODOO_DB, uid, ODOO_API_KEY,
                            "sale.order", "search_read",
                            [[["id", "=", order_id]]],
                            { fields: ["id", "name", "partner_id", "date_order", "payment_term_id", "amount_total", "order_line"] }
                        ]
                    },
                    id: Date.now()
                })
            });
            const orderData = await orderRes.json();
            if (!orderData.result || orderData.result.length === 0) {
                return res.status(404).json({ error: "Pedido não encontrado" });
            }

            const order = orderData.result[0];
            const lineIds = order.order_line || [];

            // Busca linhas do pedido
            let lines = [];
            if (lineIds.length > 0) {
                const linesRes = await fetch(ODOO_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "call",
                        params: {
                            service: "object",
                            method: "execute_kw",
                            args: [
                                ODOO_DB, uid, ODOO_API_KEY,
                                "sale.order.line", "search_read",
                                [[["id", "in", lineIds]]],
                                { fields: ["id", "product_id", "product_uom_qty", "price_unit", "discount", "price_subtotal"] }
                            ]
                        },
                        id: Date.now()
                    })
                });
                const linesData = await linesRes.json();
                lines = linesData.result || [];
            }

            // Busca condições de pagamento
            const termRes = await fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [
                            ODOO_DB, uid, ODOO_API_KEY,
                            "account.payment.term", "search_read",
                            [[]],
                            { fields: ["id", "name"] }
                        ]
                    },
                    id: Date.now()
                })
            });
            const termData = await termRes.json();

            // Busca produtos elegíveis
            const prodRes = await fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [
                            ODOO_DB, uid, ODOO_API_KEY,
                            "product.product", "search_read",
                            [[["sale_ok", "=", true]]],
                            { fields: ["id", "display_name", "list_price"] }
                        ]
                    },
                    id: Date.now()
                })
            });
            const prodData = await prodRes.json();

            return res.status(200).json({
                order,
                lines,
                payment_terms: termData.result || [],
                products: prodData.result || []
            });
        }

        // 4. ATUALIZAR PEDIDO DE VENDA
        if (action === "update_sale") {
            const { order_id, date_order, payment_term_id, lines } = body;

            const updateVals = {};
            if (date_order) updateVals.date_order = date_order;
            if (payment_term_id) updateVals.payment_term_id = Number(payment_term_id);

            if (Object.keys(updateVals).length > 0) {
                await fetch(ODOO_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "call",
                        params: {
                            service: "object",
                            method: "execute_kw",
                            args: [
                                ODOO_DB, uid, ODOO_API_KEY,
                                "sale.order", "write",
                                [[Number(order_id)], updateVals]
                            ]
                        },
                        id: Date.now()
                    })
                });
            }

            for (const line of lines || []) {
                if (line.id) {
                    await fetch(ODOO_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            jsonrpc: "2.0",
                            method: "call",
                            params: {
                                service: "object",
                                method: "execute_kw",
                                args: [
                                    ODOO_DB, uid, ODOO_API_KEY,
                                    "sale.order.line", "write",
                                    [[Number(line.id)], {
                                        product_id: Number(line.product_id),
                                        product_uom_qty: parseFloat(line.qty),
                                        price_unit: parseFloat(line.price),
                                        discount: parseFloat(line.discount)
                                    }]
                                ]
                            },
                            id: Date.now()
                        })
                    });
                }
            }

            return res.status(200).json({ success: true });
        }

        // 5. BUSCAR ESTOQUE
        if (action === "get_stock") {
            const query = body.query || "";
            const stockRes = await fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [
                            ODOO_DB, uid, ODOO_API_KEY,
                            "stock.quant", "search_read",
                            [[
                                ["location_id.usage", "=", "internal"],
                                ["product_id.name", "ilike", query],
                                ["quantity", ">", 0]
                            ]],
                            { 
                                fields: ["id", "location_id", "product_id", "quantity"], 
                                limit: 100 
                            }
                        ]
                    },
                    id: Date.now()
                })
            });

            const stockData = await stockRes.json();
            return res.status(200).json({ result: stockData.result || [] });
        }

        // 6. ATUALIZAR PRODUTO
        if (action === "update") {
            const { id, name, list_price, standard_price, categ_id } = body;

            if (!id) {
                return res.status(400).json({ error: "ID do produto é obrigatório." });
            }

            const novoNome = name ? String(name).trim() : null;

            const templateData = {};
            if (list_price !== undefined) templateData.list_price = parseFloat(list_price) || 0.0;
            if (standard_price !== undefined) templateData.standard_price = parseFloat(standard_price) || 0.0;
            if (novoNome) templateData.name = novoNome;
            if (categ_id) templateData.categ_id = Number(categ_id);

            await fetch(ODOO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        service: "object",
                        method: "execute_kw",
                        args: [
                            ODOO_DB, uid, ODOO_API_KEY,
                            "product.template", "write",
                            [[Number(id)], templateData],
                            { context: { lang: "pt_BR" } }
                        ]
                    },
                    id: Date.now()
                })
            });

            return res.status(200).json({ success: true, message: "Produto atualizado com sucesso!" });
        }

        // 7. PESQUISAR PRODUTOS (Padrão)
        const query = body.query || "";
        const prodRes = await fetch(ODOO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "object",
                    method: "execute_kw",
                    args: [
                        ODOO_DB, uid, ODOO_API_KEY,
                        "product.template", "search_read",
                        [[["name", "ilike", query]]],
                        { 
                            fields: ["id", "name", "list_price", "standard_price", "qty_available", "type", "categ_id"], 
                            limit: 100 
                        }
                    ]
                },
                id: Date.now()
            })
        });

        const prodData = await prodRes.json();
        const lista = prodData.result || [];
        const produtosFiltrados = lista.filter(prod => prod.type !== "service");

        return res.status(200).json({ result: produtosFiltrados });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
