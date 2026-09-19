export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { action, query, id, name, list_price, standard_price, categ_id, order_id, date_order, payment_term_id, lines } = req.body;

    const URL = 'https://deuris-candy-2.odoo.com';
    const DB = 'deuris-candy-2';
    const USERNAME = process.env.ODOO_USERNAME;
    const PASSWORD = process.env.ODOO_PASSWORD;

    async function odooRpc(service, method, args) {
        const response = await fetch(`${URL}/jsonrpc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: { service, method, args },
                id: Math.floor(Math.random() * 1000)
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.data?.message || 'Erro no Odoo');
        return data.result;
    }

    try {
        const uid = await odooRpc('common', 'authenticate', [DB, USERNAME, PASSWORD, {}]);
        if (!uid) return res.status(401).json({ error: 'Falha na autenticação' });

        if (action === 'get_categories') {
            const categories = await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'product.category', 'search_read', [[]], { fields: ['id', 'name'] }
            ]);
            return res.status(200).json({ categories });
        }

        if (action === 'search') {
            const domain = query ? [['name', 'ilike', query]] : [];
            const result = await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'product.template', 'search_read', [domain],
                { fields: ['id', 'name', 'list_price', 'standard_price', 'qty_available', 'categ_id'] }
            ]);
            return res.status(200).json({ result });
        }

        if (action === 'update') {
            await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'product.template', 'write',
                [[id], { name, list_price, standard_price, categ_id }]
            ]);
            return res.status(200).json({ success: true });
        }

        if (action === 'get_stock') {
            const domain = [['quantity', '>', 0]];
            if (query) domain.push(['product_id.name', 'ilike', query]);
            const result = await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'stock.quant', 'search_read', [domain],
                { fields: ['id', 'location_id', 'product_id', 'quantity'] }
            ]);
            return res.status(200).json({ result });
        }

        if (action === 'get_sales') {
            const domain = [('state', '=', 'sale')];
            if (query) {
                domain.push('|', ('name', 'ilike', query), ('partner_id.name', 'ilike', query));
            }
            const result = await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'sale.order', 'search_read', [domain],
                { fields: ['id', 'name', 'partner_id', 'amount_total'] }
            ]);
            return res.status(200).json({ result });
        }

        if (action === 'get_sale_detail') {
            const order = await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'sale.order', 'search_read', [[['id', '=', order_id]]],
                { fields: ['id', 'name', 'partner_id', 'date_order', 'payment_term_id', 'amount_total', 'order_line'] }
            ]);

            if (!order.length) return res.status(404).json({ error: 'Pedido não encontrado' });

            const lineIds = order[0].order_line || [];
            let linesData = [];
            if (lineIds.length > 0) {
                linesData = await odooRpc('object', 'execute_kw', [
                    DB, uid, PASSWORD, 'sale.order.line', 'search_read', [[['id', 'in', lineIds]]],
                    { fields: ['id', 'product_id', 'product_uom_qty', 'price_unit', 'discount', 'price_subtotal'] }
                ]);
            }

            const payment_terms = await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'account.payment.term', 'search_read', [[]],
                { fields: ['id', 'name'] }
            ]);

            const products = await odooRpc('object', 'execute_kw', [
                DB, uid, PASSWORD, 'product.product', 'search_read', [[['sale_ok', '=', true]]],
                { fields: ['id', 'display_name', 'list_price'] }
            ]);

            return res.status(200).json({ order: order[0], lines: linesData, payment_terms, products });
        }

        if (action === 'update_sale') {
            const updateVals = {};
            if (date_order) updateVals.date_order = date_order;
            if (payment_term_id) updateVals.payment_term_id = parseInt(payment_term_id);

            if (Object.keys(updateVals).length > 0) {
                await odooRpc('object', 'execute_kw', [
                    DB, uid, PASSWORD, 'sale.order', 'write', [[order_id], updateVals]
                ]);
            }

            for (const line of lines || []) {
                if (line.id) {
                    await odooRpc('object', 'execute_kw', [
                        DB, uid, PASSWORD, 'sale.order.line', 'write',
                        [[parseInt(line.id)], {
                            product_id: parseInt(line.product_id),
                            product_uom_qty: parseFloat(line.qty),
                            price_unit: parseFloat(line.price),
                            discount: parseFloat(line.discount)
                        }]
                    ]);
                }
            }

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Ação inválida' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
