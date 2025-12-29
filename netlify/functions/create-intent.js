// netlify/functions/create-intent.js
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { price, email } = JSON.parse(event.body || '{}');
    if (!price) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing price' }) };
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    // Look up the Price to get amount & currency
    const priceObj = await stripe.prices.retrieve(price, { expand: ['product'] });
    if (!priceObj || !priceObj.unit_amount || !priceObj.currency) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Bad price ID' }) };
    }

    // Create PaymentIntent for that price
    const intent = await stripe.paymentIntents.create({
      amount: priceObj.unit_amount,
      currency: priceObj.currency,
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ clientSecret: intent.client_secret }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Server error' }),
    };
  }
};
