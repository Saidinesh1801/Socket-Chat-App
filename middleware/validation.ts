import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

interface SchemaDict {
  [key: string]: Joi.ObjectSchema;
}

const schemas: SchemaDict = {
  signup: Joi.object({
    username: Joi.string().alphanum().min(2).max(24).required()
      .messages({
        'string.alphanum': 'Username must contain only letters and numbers',
        'string.min': 'Username must be at least {#limit} characters',
        'string.max': 'Username must not exceed {#limit} characters',
        'any.required': 'Username is required'
      }),
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string().min(4).max(100).required()
      .messages({
        'string.min': 'Password must be at least {#limit} characters',
        'string.max': 'Password must not exceed {#limit} characters',
        'any.required': 'Password is required'
      })
  }),

  login: Joi.object({
    username: Joi.string().required()
      .messages({ 'any.required': 'Username is required' }),
    password: Joi.string().required()
      .messages({ 'any.required': 'Password is required' })
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      })
  }),

  verifyOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().min(6).max(6).pattern(/^\d+$/).required()
      .messages({
        'string.length': 'OTP must be 6 digits',
        'string.pattern.base': 'OTP must contain only numbers',
        'any.required': 'OTP is required'
      }),
    newPassword: Joi.string().min(4).max(100).required()
      .messages({
        'string.min': 'Password must be at least {#limit} characters',
        'any.required': 'New password is required'
      })
  }),

  createRoom: Joi.object({
    name: Joi.string().min(1).max(50).pattern(/^[a-zA-Z0-9_-]+$/).required()
      .messages({
        'string.pattern.base': 'Room name can only contain letters, numbers, underscore and hyphen',
        'any.required': 'Room name is required'
      }),
    password: Joi.string().allow('', null).max(100)
  }),

  joinRoom: Joi.object({
    room: Joi.string().required(),
    password: Joi.string().allow('', null)
  }),

  chatMessage: Joi.object({
    text: Joi.string().max(5000).allow(''),
    room: Joi.string().required(),
    replyTo: Joi.object({
      _id: Joi.string(),
      user: Joi.string(),
      text: Joi.string()
    }).allow(null),
    file: Joi.object({
      filename: Joi.string(),
      originalname: Joi.string(),
      mimetype: Joi.string(),
      size: Joi.number(),
      url: Joi.string()
    }).allow(null)
  }),

  updateStatus: Joi.object({
    status: Joi.string().max(100).allow('')
  })
};

const validate = (schemaName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next();
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors 
      });
    }

    req.body = value;
    next();
  };
};

export { schemas, validate };
