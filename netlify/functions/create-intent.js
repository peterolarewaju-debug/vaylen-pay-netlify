// netlify/functions/create-intent.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// CORS headers (use '*' while testing; lock to your domain when done)
const headers = {
  'Access-Control-Allow-Origin': '*', // change to 'https://www.joinvaylen.com' later
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  // Preflight
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
      // Normal path: look up a Stripe Price and use its amount/currency
      const p = await stripe.prices.retrieve(price);

      if (!p || !p.active || !p.unit_amount || !p.currency) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error:
              `Price not usable. Check that the Price ID exists, is active, and has amount & currency. price=${price}`,
          }),
        };
      }
      unit_amount = p.unit_amount;
      curr = p.currency;
    } else if (amount && currency) {
      // Fallback path: explicit amount/currency
      unit_amount = Number(amount);
      curr = String(currency).toLowerCase();
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Provide either "price" or both "amount" and "currency".',
        }),
      };
    }

    const intent = await stripe.paymentIntents.create({
      amount: unit_amount,
      currency: curr,
      automatic_payment_methods: { enabled: true },
      ...(email ? { receipt_email: email } : {}),
      metadata: {
        source: 'netlify-payment-element',
        price: price || '',
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ clientSecret: intent.client_secret }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Server error' }),
    };
  }
};
