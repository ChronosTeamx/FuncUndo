export async function processPayment(orderId, userId, paymentMethodId) {
  try {
    const order = await getOrder(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const inventoryAvailable = await validateInventory(order.items);

    if (!inventoryAvailable) {
      throw new Error('Inventory validation failed');
    }

    const user = await getUser(userId);

    const charge = await paymentGateway.process({
      amount: order.total,
      currency: 'USD',
      paymentMethodId,
      customerId: user.customerId,
    });

    await createTransaction({
      userId,
      orderId,
      amount: order.total,
      paymentId: charge.id,
      status: 'success',
    });

    await Promise.all([
      updateOrderStatus(orderId, 'paid'),

      sendPaymentConfirmation(user.email, order),

      analytics.track('payment_success', {
        userId,
        orderId,
        amount: order.total,
      }),
    ]);

    return {
      success: true,
      paymentId: charge.id,
    };
  } catch (error) {
    logger.error('Payment failed', {
      orderId,
      userId,
      error,
    });

    throw error;
  }
}
