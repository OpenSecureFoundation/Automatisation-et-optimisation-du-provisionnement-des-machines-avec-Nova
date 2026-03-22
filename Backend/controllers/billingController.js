const { Invoice, InvoiceItem, User, PricingRule, PaymentMethod } = require('../models');
const { calculateInvoiceForPeriod } = require('../services/billingEngine');
const { generatePdf } = require('../services/invoiceGenerator');
const { Op } = require('sequelize');

async function listInvoices(req, res, next) {
  try {
    const userId = req.userId;
    const invoices = await Invoice.findAll({
      where: { userId },
      order: [['generatedAt', 'DESC']],
      include: []
    });
    res.json({
      success: true,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        totalAmount: Number(inv.totalAmount),
        currency: inv.currency,
        status: inv.status,
        generatedAt: inv.generatedAt
      }))
    });
  } catch (err) {
    next(err);
  }
}

async function getInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const invoice = await Invoice.findOne({
      where: { id, userId },
      include: [{ model: InvoiceItem, as: 'InvoiceItems' }]
    });
    if (!invoice) {
      return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
    }
    const items = (invoice.InvoiceItems || []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total)
    }));
    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status,
        generatedAt: invoice.generatedAt,
        items
      }
    });
  } catch (err) {
    next(err);
  }
}

async function downloadInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const invoice = await Invoice.findOne({
      where: { id, userId },
      include: [
        { model: User, as: 'User', attributes: ['name', 'email'] },
        { model: InvoiceItem, as: 'InvoiceItems' }
      ]
    });
    if (!invoice) {
      return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
    }
    const user = invoice.User || {};
    const items = (invoice.InvoiceItems || []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total)
    }));
    const pdfBuffer = await generatePdf({
      invoiceNumber: invoice.invoiceNumber,
      clientName: user.name || user.email,
      clientEmail: user.email,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      items,
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency || 'XAF'
    });
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      return res.status(500).json({ error: { message: 'PDF generation failed', status: 500 } });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture_${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/invoices/:id/download
 * Télécharger une facture (admin peut télécharger n'importe quelle facture)
 */
async function downloadAdminInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findOne({
      where: { id },
      include: [
        { model: User, as: 'User', attributes: ['name', 'email'] },
        { model: InvoiceItem, as: 'InvoiceItems' }
      ]
    });
    if (!invoice) {
      return res.status(404).json({ error: { message: 'Facture introuvable', status: 404 } });
    }
    const user = invoice.User || {};
    const items = (invoice.InvoiceItems || []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total)
    }));
    const pdfBuffer = await generatePdf({
      invoiceNumber: invoice.invoiceNumber,
      clientName: user.name || user.email,
      clientEmail: user.email,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      items,
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency || 'XAF'
    });
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      return res.status(500).json({ error: { message: 'Échec génération PDF', status: 500 } });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture_${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

async function createInvoice(req, res, next) {
  try {
    const userId = req.userId;
    const { periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        error: { message: 'periodStart and periodEnd required (YYYY-MM-DD)', status: 400 }
      });
    }
    const { totalAmount, items, currency } = await calculateInvoiceForPeriod(
      userId,
      periodStart,
      periodEnd
    );
    const count = await Invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const invoice = await Invoice.create({
      userId,
      invoiceNumber,
      periodStart,
      periodEnd,
      totalAmount,
      currency,
      status: 'pending'
    });
    for (const it of items) {
      await InvoiceItem.create({
        invoiceId: invoice.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total
      });
    }
    res.status(201).json({
      success: true,
      message: 'Invoice created',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status
      }
    });
  } catch (err) {
    next(err);
  }
}

async function payInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const invoice = await Invoice.findOne({ where: { id, userId } });
    if (!invoice) {
      return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
    }
    invoice.status = 'paid';
    await invoice.save();
    res.json({ success: true, message: 'Invoice marked as paid', invoice: invoice.toJSON() });
  } catch (err) {
    next(err);
  }
}

async function getPricingRules(req, res, next) {
  try {
    const rules = await PricingRule.findAll({
      order: [['resourceType', 'ASC'], ['effectiveDate', 'DESC']]
    });
    const byType = {};
    for (const r of rules) {
      if (!byType[r.resourceType]) byType[r.resourceType] = r;
    }
    res.json({
      success: true,
      pricingRules: Object.values(byType).map((r) => ({
        id: r.id,
        resourceType: r.resourceType,
        unitPrice: Number(r.unitPrice),
        unit: r.unit,
        currency: r.currency,
        effectiveDate: r.effectiveDate
      }))
    });
  } catch (err) {
    next(err);
  }
}

async function updatePricingRules(req, res, next) {
  try {
    const rules = req.body.rules || req.body;
    const array = Array.isArray(rules) ? rules : [rules];
    const updated = [];
    for (const r of array) {
      const [instance] = await PricingRule.upsert({
        resourceType: r.resourceType,
        unitPrice: r.unitPrice,
        unit: r.unit || 'hour',
        currency: r.currency || 'XAF',
        effectiveDate: r.effectiveDate || new Date().toISOString().slice(0, 10)
      }, { returning: true });
      if (instance) updated.push(instance);
    }
    res.json({ success: true, pricingRules: updated });
  } catch (err) {
    next(err);
  }
}

async function getBillingPreferences(req, res, next) {
  try {
    const user = await User.findByPk(req.userId, { attributes: ['id', 'paymentMode'] });
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }
    const card = await PaymentMethod.findOne({
      where: { userId: req.userId },
      order: [['updatedAt', 'DESC']]
    });
    res.json({
      success: true,
      preferences: {
        paymentMode: user.paymentMode || 'manual',
        card: card
          ? {
              last4: card.last4,
              brand: card.brand,
              isTest: card.isTest,
              hasCard: true
            }
          : { hasCard: false }
      }
    });
  } catch (err) {
    next(err);
  }
}

async function updateBillingPreferences(req, res, next) {
  try {
    const { paymentMode, card } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }
    if (paymentMode === 'manual' || paymentMode === 'auto') {
      user.paymentMode = paymentMode;
      await user.save();
    }
    if (card && paymentMode === 'auto') {
      const last4 = (card.cardNumber || '').slice(-4);
      let pm = await PaymentMethod.findOne({ where: { userId: req.userId } });
      if (pm) {
        await pm.update({
          cardNumber: card.cardNumber || null,
          cardExpiry: card.cardExpiry || null,
          cardCvv: card.cardCvv || null,
          last4: last4 || null,
          brand: card.brand || 'TEST',
          isTest: true
        });
      } else {
        await PaymentMethod.create({
          userId: req.userId,
          cardNumber: card.cardNumber || null,
          cardExpiry: card.cardExpiry || null,
          cardCvv: card.cardCvv || null,
          last4: last4 || null,
          brand: card.brand || 'TEST',
          isTest: true
        });
      }
    }
    const cardRow = await PaymentMethod.findOne({
      where: { userId: req.userId },
      order: [['updatedAt', 'DESC']]
    });
    res.json({
      success: true,
      preferences: {
        paymentMode: user.paymentMode || 'manual',
        card: cardRow
          ? { last4: cardRow.last4, brand: cardRow.brand, isTest: cardRow.isTest, hasCard: true }
          : { hasCard: !!card }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/invoices
 * Liste toutes les factures (admin only) avec filtres, tri et pagination
 */
async function listAdminInvoices(req, res, next) {
  try {
    const {
      status,
      userId,
      dateFrom,
      dateTo,
      sort = 'generatedAt',
      order = 'DESC',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (dateFrom || dateTo) {
      where.generatedAt = {};
      if (dateFrom) {
        where.generatedAt[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.generatedAt[Op.lte] = endDate;
      }
    }

    const validSortFields = ['generatedAt', 'totalAmount', 'status', 'invoiceNumber'];
    const sortField = validSortFields.includes(sort) ? sort : 'generatedAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows: invoices } = await Invoice.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortField, sortOrder]],
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'email', 'name']
        }
      ]
    });

    res.json({
      success: true,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        totalAmount: Number(inv.totalAmount),
        currency: inv.currency,
        status: inv.status,
        generatedAt: inv.generatedAt,
        user: inv.User ? {
          id: inv.User.id,
          email: inv.User.email,
          name: inv.User.name
        } : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/invoices/:id
 * Détail d'une facture (admin peut voir n'importe quelle facture)
 */
async function getAdminInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findOne({
      where: { id },
      include: [
        { model: InvoiceItem, as: 'InvoiceItems' },
        { model: User, as: 'User', attributes: ['id', 'email', 'name'] }
      ]
    });
    if (!invoice) {
      return res.status(404).json({ error: { message: 'Facture introuvable', status: 404 } });
    }
    const items = (invoice.InvoiceItems || []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total)
    }));
    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status,
        generatedAt: invoice.generatedAt,
        items,
        user: invoice.User ? {
          id: invoice.User.id,
          email: invoice.User.email,
          name: invoice.User.name
        } : null
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listInvoices,
  getInvoice,
  getAdminInvoice,
  downloadInvoice,
  downloadAdminInvoice,
  createInvoice,
  payInvoice,
  getPricingRules,
  updatePricingRules,
  getBillingPreferences,
  updateBillingPreferences,
  listAdminInvoices
};
