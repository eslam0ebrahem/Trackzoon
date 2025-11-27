import Joi from 'joi';

export const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        next();
    };
};

export const schemas = {
    login: Joi.object({
        password: Joi.string().required()
    }),
    addProduct: Joi.object({
        url: Joi.string().uri().required(),
        threshold: Joi.number().min(0).optional(),
        chatId: Joi.string().optional()
    }),
    previewProduct: Joi.object({
        url: Joi.string().uri().required()
    }),
    bulkImport: Joi.object({
        urls: Joi.array().items(Joi.string().uri()).required()
    }),
    updateTags: Joi.object({
        tags: Joi.array().items(Joi.string()).required()
    }),
    updateTarget: Joi.object({
        targetPrice: Joi.number().min(0).required()
    }),
    archive: Joi.object({
        isArchived: Joi.boolean().required()
    })
};
