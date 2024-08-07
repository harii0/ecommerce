import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    shippingAddress1: { type: String, required: true },
    shippingAddress2: { type: String },
    city: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true },

    phone: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'shipped',
        'completed',
        'cancelled',
        'returned',
      ],
      default: 'pending',
    },
    totalPrice: { type: Number },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'failed'],
      default: 'unpaid',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    dateOrdered: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
