export default async function handler(req, res) {
    // Configurações de Acesso ao Odoo
    const ODOO_URL = "https://deuris-candy-2.odoo.com/jsonrpc";
    const ODOO_DB = "deuris-candy-2";
    const ODOO_USER = "isaquemoises14@gmail.com";
    const ODOO_API_KEY = "0757a6c247886172bff32acdceb0122735bb3278";

    // Trata o corpo da requisição enviada pelo front-end
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const query = body.query || "";

    try {
        // 1. Autenticação no Odoo via JSON-RPC
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
            return res.status(401).json({ 
                error: "Falha na autenticação com o Odoo.", 
                details: authData 
            });
        }

        // 2. Procura apenas produtos onde o tipo é Mercadorias ('consu' ou 'product')
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
                        ODOO_DB,
                        uid,
                        ODOO_API_KEY,
                        "product.template",
                        "search_read",
                        [
                            [
                                ["name", "ilike", query],
                                ["detailed_type", "in", ["consu", "product"]]
                            ]
                        ],
                        { 
                            fields: ["id", "name", "list_price", "standard_price", "qty_available"], 
                            limit: 50 
                        }
                    ]
                },
                id: Date.now()
            })
        });

        const prodData = await prodRes.json();
        return res.status(200).json({ result: prodData.result || [] });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
