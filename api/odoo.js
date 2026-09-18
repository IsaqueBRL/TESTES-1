export default async function handler(req, res) {
    const ODOO_URL = "https://deuris-candy-2.odoo.com/jsonrpc";
    const ODOO_DB = "deuris-candy-2";
    const ODOO_USER = "isaquemoises14@gmail.com";
    const ODOO_API_KEY = "0757a6c247886172bff32acdceb0122735bb3278";

    // Defina uma senha de admin para autorizar as alterações no site
    const SENHA_ADMIN = "123456"; 

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = body.action || "search";

    try {
        // 1. Autenticação no Odoo
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

        // 2. Ação de ATUALIZAR produto no Odoo
        if (action === "update") {
            const { id, name, list_price, standard_price, password } = body;

            if (password !== SENHA_ADMIN) {
                return res.status(403).json({ error: "Senha de administração incorreta." });
            }

            const updateRes = await fetch(ODOO_URL, {
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
                            "write",
                            [
                                [Number(id)],
                                {
                                    name: name,
                                    list_price: parseFloat(list_price),
                                    standard_price: parseFloat(standard_price)
                                }
                            ]
                        ]
                    },
                    id: Date.now()
                })
            });

            const updateData = await updateRes.json();

            if (updateData.error) {
                return res.status(500).json({ error: "Erro ao atualizar no Odoo.", details: updateData.error });
            }

            return res.status(200).json({ success: true, message: "Produto atualizado com sucesso!" });
        }

        // 3. Ação de BUSCAR produtos (Comportamento padrão)
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
                        ODOO_DB,
                        uid,
                        ODOO_API_KEY,
                        "product.template",
                        "search_read",
                        [[["name", "ilike", query]]],
                        { 
                            fields: ["id", "name", "list_price", "standard_price", "qty_available", "detailed_type", "type", "categ_id"], 
                            limit: 100 
                        }
                    ]
                },
                id: Date.now()
            })
        });

        const prodData = await prodRes.json();
        const lista = prodData.result || [];

        // Filtra para remover serviços e despesas
        const apenasMercadorias = lista.filter(prod => {
            const tipo = prod.detailed_type || prod.type || "";
            const cat = Array.isArray(prod.categ_id) ? prod.categ_id[1] : "";
            return tipo !== "service" && !cat.toUpperCase().includes("DESPESAS");
        });

        return res.status(200).json({ result: apenasMercadorias });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
