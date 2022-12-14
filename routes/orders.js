// Importing express module
const express = require("express")
const bodyParser = require('body-parser')

// Creating express router
const router = express.Router()
const { pool } = require('../config')
router.use(bodyParser.json())
router.use(bodyParser.urlencoded({ extended: true }))

// Handling request using router
router.get("/orders", (req, res, next) => {
    pool
        .query('SELECT * FROM orders')
        .then(results => res.status(200).send(results.rows))
        .catch(e => console.error(e.stack))
})

router.get("/orders/:id", (req, res, next) => {
    const { id } = req.params;
    pool
        .query('SELECT * FROM orders WHERE order_id=$1',
            [id])
        .then(results => res.status(200).send(results.rows))
        .catch(e => console.error(e.stack))
})


router.post("/orders", (req, res, next) => {
    const { order_customer_name, order_customer_phone_number, resturant_id, existingCart } = req.body
        //https://node-postgres.com/features/transactions according to docs, must use client.query for transaction, instead of pool.query
        ; (async () => {
            const client = await pool.connect()
            try {
                await client.query('BEGIN')
                const queryText = 'INSERT INTO orders (order_customer_name, order_customer_phone_number,resturant_id) VALUES ($1, $2, $3) RETURNING order_id;'
                const response = await client.query(queryText, [order_customer_name, order_customer_phone_number, resturant_id])
                let queryLineItem = 'INSERT INTO line_items (line_item_name, line_item_price, order_id) VALUES'
                let preparedArray = [];
                let counter = 0;
                const orderId = response.rows[0].order_id
                await existingCart.forEach((element, index) => {
                    //turn object into array and push into prepared Array
                    preparedArray.push(Object.values(element))
                    preparedArray.push(orderId)
                    queryLineItem += `($${counter + 1}, $${counter + 2}, $${counter + 3})`
                    counter += 3;
                    if (index !== existingCart.length - 1) {
                        queryLineItem += ', '
                    } else {
                        queryLineItem += ';'
                    }
                });
                const flattenedArray = preparedArray.flatMap(num => num);
                console.log('queryLineItem', queryLineItem)
                console.log('flattened', flattenedArray)
                await client.query(queryLineItem, flattenedArray)
                await client.query('COMMIT');
                res.status(201).json({ status: 'success', message: 'Order and line_items added.', orderId: orderId });
            } catch (e) {
                await client.query('ROLLBACK');
                console.log('data not commited. Rolling back.');
                throw e
            } finally {
                client.release()
            }
        })().catch(e => console.error(e.stack))
})

router.put("/orders/:id", (req, res, next) => {
    const { id } = req.params;
    const { order_customer_name, order_customer_phone_number, resturant_id } = req.body

    pool
        .query('UPDATE orders SET order_customer_name=$1 , order_customer_phone_number=$2, resturant_id=$3 WHERE order_id=$4',
            [order_customer_name, order_customer_phone_number, resturant_id, id])
        .then(results => res.status(201).json({ status: 'success', message: 'Order updated.' }))
        .catch(e => console.error(e.stack))
})

router.delete("/orders/:id", (req, res, next) => {
    const { id } = req.params;
    pool
        .query('DELETE FROM orders WHERE order_id=$1',
            [id])
        .then(results => res.status(204).json({ status: 'success', message: 'Order deleted.' }))
        .catch(e => console.error(e.stack))
})

// Exporting router
module.exports = router