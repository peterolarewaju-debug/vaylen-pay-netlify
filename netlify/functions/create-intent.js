// netlify/functions/create-intent.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Tiny helper for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',           // tighten later: 'https://joinvaylen.com'
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'ok' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const { price, amount, currency, email } = JSON.parse(event.body || '{}');

    let unit_amount, curr;

    if (price) {
      // Normal mode: use a Stripe Price to derive amount & currency
      const p = await stripe.prices.retrieve(price);
      if (!p || !p.active || !p.unit_amount || !p.currency) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Price not usable' }) };
      }
      unit_amount = p.unit_amount;
      curr       = p.currency;
    } else if (amount && currency) {
      // Smoke-test mode: caller provides amount & currency directly
      unit_amount = Number(amount);
      curr        = String(currency).toLowerCase();
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Provide either "price" or "amount"+"currency".' })
      };
    }

    const intent = await stripe.paymentIntents.create({
      amount: unit_amount,
      currency: curr,
      automatic_payment_methods: { enabled: true },
      ...(email ? { receipt_email: email } : {}),
      metadata: { source: 'netlify-payment-element' }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ clientSecret: intent.client_secret })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Server error' })
    };
  }
};
