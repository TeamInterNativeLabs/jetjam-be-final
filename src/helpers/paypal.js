const paypalClient = require('../configs/paypal');

async function getFetch() {
    return (await import('node-fetch')).default;
}

const getUserCurrentSubscription = async email => {

    const accessToken = await paypalClient.getAccessToken();

    const subscription = await fetch(`${process.env.PAYPAL_API_URL}/v1/billing/subscriptions?status=ACTIVE&email_address=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!subscription.ok) {
        throw new Error(`Failed to fetch subscriptions: ${subscription}`);
    }

    const subscriptions_data = await subscription.json();
    return subscriptions_data.subscriptions || [];

};

const cancelPayPalSubscription = async (subscriptionId, reason = 'Customer requested cancellation') => {
    const accessToken = await paypalClient.getAccessToken();
    const res = await fetch(`${process.env.PAYPAL_API_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `PayPal cancel failed: ${res.status}`);
    }
};

module.exports = {
    getUserCurrentSubscription,
    cancelPayPalSubscription
}
