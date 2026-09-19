export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_USER = process.env.ODOO_USER;
    const ODOO_PASS = process.env.ODOO_PASS;

    if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_PASS) {
        return res.status(500).json({ error: "Variáveis de ambiente do Odoo não configuradas." });
    }

    const jsonrpc = async (endpoint, method, params) => {
        const response = await fetch(`${ODOO_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: Math.floor(Math.random() * 1000)
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.data?.message || data.error.message);
        return data.result;
    };

    try {
        // 1. Autenticação
        const uid = await jsonrpc('/jsonrpc', 'call', {
            service: 'common',
            method: 'login',
            args: [ODOO_DB, ODOO_USER, ODOO_PASS]
        });

        if (!uid) return res.status(401).json({ error: 'Falha na autenticação com Odoo.' });

        const execute = (model, method, args, kwargs = {}) => {
            return jsonrpc('/jsonrpc', 'call', {
                service: 'object',
                method: 'execute_kw',
                args: [ODOO_DB, uid, ODOO_PASS, model, method, args, kwargs]
            });
        };

        const { action, query, id, order_id } = req.body;

        // BUSCAR PRODUTOS
        if (action === 'search') {
            const domain = query ? [['name', 'ilike', query]] : [];
            const result = await execute('product.product', 'search_read', [domain], {
                fields: ['id', 'name', 'list_price', 'standard_price', 'qty_available', 'categ_id'],
                limit: 50
            });
            return res.status(200).json({ result });
        }

        // BUSCAR ESTOQUE
        if (action === 'get_stock') {
            const domain = query ? [['product_id.name', 'ilike', query]] : [];
            const result = await execute('stock.quant', 'search_read', [domain], {
                fields: ['id', 'location_id', 'product_id', 'quantity'],
                limit: 50
            });
            return res.status(200).json({ result });
        }

        // BUSCAR VENDAS
        if (action === 'get_sales') {
            const domain = query ? ['|', ['name', 'ilike', query], ['partner_id.name', 'ilike', query]] : [];
            const result = await execute('sale.order', 'search_read', [domain], {
                fields: ['id', 'name', 'partner_id', 'amount_total', 'state', 'locked'],
                limit: 50
            });
            return res.status(200).json({ result });
        }

        // DADOS PARA NOVA VENDA / EDIÇÃO
        if (action === 'get_new_sale_data') {
            const partners = await execute('res.partner', 'search_read', [[]], {
                fields: ['id', 'name'],
                limit: 100
            });
            const paymentTerms = await execute('account.payment.term', 'search_read', [[]], {
                fields: ['id', 'name']
            });
            const products = await execute('product.product', 'search_read', [[['sale_ok', '=', true]]], {
                fields: ['id', 'display_name', 'list_price']
            });
            return res.status(200).json({ partners, paymentTerms, products });
        }

        // DETALHES DE UMA VENDA
        if (action === 'get_sale_detail') {
            const orders = await execute('sale.order', 'search_read', [[['id', '=', order_id]]], {
                fields: ['id', 'name', 'partner_id', 'date_order', 'payment_term_id', 'order_line', 'state', 'locked']
            });
            if (!orders || orders.length === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });

            const order = orders[0];
            const lines = await execute('sale.order.line', 'search_read', [[['id', 'in', order.order_line]]], {
                fields: ['id', 'product_id', 'product_uom_qty', 'price_unit', 'discount', 'price_subtotal']
            });

            const paymentTerms = await execute('account.payment.term', 'search_read', [[]], { fields: ['id', 'name'] });
            const products = await execute('product.product', 'search_read', [[['sale_ok', '=', true]]], {
                fields: ['id', 'display_name', 'list_price']
            });

            return res.status(200).json({ order, lines, payment_terms: paymentTerms, products });
        }

        // CRIAR NOVA VENDA (COTAÇÃO)
        if (action === 'create_sale') {
            const { partner_id, payment_term_id, lines } = req.body;
            
            const lineCommands = lines.map(l => [0, 0, {
                product_id: Number(l.product_id),
                product_uom_qty: Number(l.qty),
                price_unit: Number(l.price)
            }]);

            const newOrderId = await execute('sale.order', 'create', [{
                partner_id: Number(partner_id),
                payment_term_id: payment_term_id ? Number(payment_term_id) : false,
                order_line: lineCommands
            }]);

            const newOrder = await execute('sale.order', 'search_read', [[['id', '=', newOrderId]]], { fields: ['name'] });

            return res.status(200).json({ success: true, id: newOrderId, name: newOrder[0].name });
        }

        // CONFIRMAR PEDIDO DE VENDA
        if (action === 'confirm_sale') {
            await execute('sale.order', 'action_confirm', [[order_id]]);
            return res.status(200).json({ success: true });
        }

        // TRAVAR / DESTRAVAR
        if (action === 'toggle_lock_sale') {
            const { lock } = req.body; // true = travar, false = destravar
            const method = lock ? 'action_lock' : 'action_unlock';
            await execute('sale.order', method, [[order_id]]);
            return res.status(200).json({ success: true });
        }

        // ATUALIZAR PEDIDO
        if (action === 'update_sale') {
            const { payment_term_id, lines } = req.body;
            
            await execute('sale.order', 'write', [[order_id], {
                payment_term_id: payment_term_id ? Number(payment_term_id) : false
            }]);

            for (const l of lines) {
                if (l.id) {
                    await execute('sale.order.line', 'write', [[Number(l.id)], {
                        product_id: Number(l.product_id),
                        product_uom_qty: Number(l.qty),
                        price_unit: Number(l.price)
                    }]);
                }
            }
            return res.status(200).json({ success: true });
        }

        // CATEGORIAS & UPDATE DE PRODUTO
        if (action === 'get_categories') {
            const categories = await execute('product.category', 'search_read', [[]], { fields: ['id', 'name'] });
            return res.status(200).json({ categories });
        }

        if (action === 'update') {
            const { name, list_price, standard_price, categ_id } = req.body;
            await execute('product.template', 'write', [[id], {
                name,
                list_price: Number(list_price),
                standard_price: Number(standard_price),
                categ_id: Number(categ_id)
            }]);
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Ação não reconhecida' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
