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

        // AÇÃO 1: Atualizar Produto no Odoo
        if (action === "update") {
            const { id, name, list_price, standard_price } = body;

            if (!id) {
                return res.status(400).json({ error: "ID do produto é obrigatório." });
            }

            const templateData = {};
            if (list_price !== undefined) templateData.list_price = parseFloat(list_price) || 0.0;
            if (standard_price !== undefined) templateData.standard_price = parseFloat(standard_price) || 0.0;
            if (name !== undefined) templateData.name = String(name).trim();

            // 1. Atualiza no product.template (Preços e Nome)
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
                            [[Number(id)], templateData]
                        ]
                    },
                    id: Date.now()
                })
            });

            // 2. Atualiza também no product.product para garantir a alteração do Nome na variante
            if (name) {
                const variantRes = await fetch(ODOO_URL, {
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
                                [[["product_tmpl_id", "=", Number(id)]]],
                                { fields: ["id"] }
                            ]
                        },
                        id: Date.now()
                    })
                });

                const variantData = await variantRes.json();
                if (variantData.result && variantData.result.length > 0) {
                    const variantIds = variantData.result.map(v => v.id);
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
                                    "product.product", "write",
                                    [variantIds, { name: String(name).trim() }]
                                ]
                            },
                            id: Date.now()
                        })
                    });
                }
            }

            return res.status(200).json({ success: true, message: "Produto e Nome atualizados com sucesso!" });
        }

        // AÇÃO 2: Pesquisar Produtos
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
                            fields: ["id", "name", "list_price", "standard_price", "qty_available", "type"], 
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
