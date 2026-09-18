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

        // AÇÃO: Buscar Categorias
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

        // AÇÃO: Buscar Estoque Detalhado (stock.quant)
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
                                ["product_id.name", "ilike", query]
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

        // AÇÃO: Atualizar Produto
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

            if (novoNome) {
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
                                [[Number(id)], { name: novoNome }]
                            ]
                        },
                        id: Date.now()
                    })
                });
            }

            return res.status(200).json({ success: true, message: "Produto atualizado com sucesso!" });
        }

        // AÇÃO: Pesquisar Produtos
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
