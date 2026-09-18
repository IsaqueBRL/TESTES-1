export default async function handler(req, res) {
    const ODOO_URL = "https://deuris-candy-2.odoo.com/jsonrpc";
    const ODOO_DB = "deuris-candy-2.odoo.com";
    const ODOO_USER = "isaquemoises14@gmail.com";
    const ODOO_API_KEY = "0757a6c247886172bff32acdceb0122735bb3278";

    const { query } = req.body;

    try {
        // 1. Autenticar
        const authRes = await fetch(ODOO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: { service: "common", method: "authenticate", args: [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}] },
                id: 1
            })
        });
        const authData = await authRes.json();
        const uid = authData.result;

        if (!uid) return res.status(401).json({ error: "Falha na autenticação" });

        // 2. Buscar Produtos
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
                        [[["name", "ilike", query || ""]]],
                        { fields: ["name", "list_price", "qty_available"], limit: 20 }
                    ]
                },
                id: 2
            })
        });

        const prodData = await prodRes.json();
        return res.status(200).json({ result: prodData.result });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}