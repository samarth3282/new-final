const { z } = require('zod');

const registerSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be at most 20 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
    email: z.string()
        .email('Invalid email address'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(64, 'Password must be at most 64 characters')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    role: z.enum(['patient', 'asha', 'admin']).default('patient'),
    // Required for asha/admin — verified against the pre-authorized registry
    workerCode: z.string().trim().optional(),
    lastName:   z.string().trim().optional()
}).superRefine((data, ctx) => {
    if (data.role === 'asha' || data.role === 'admin') {
        if (!data.workerCode) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workerCode'], message: 'Worker code is required for this role' });
        }
        if (!data.lastName) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastName'], message: 'Last name is required for this role' });
        }
    }
});

const loginSchema = z.object({
    identifier: z.string().min(1, 'Username or email is required'),
    password: z.string().min(1, 'Password is required')
});

const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address')
});

const resetPasswordSchema = z.object({
    newPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(64, 'Password must be at most 64 characters')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
});

// Middleware factory — validates req.body against the given zod schema
const validate = (schema) => (req, res, next) => {
    console.log('[validate] req.body received:', JSON.stringify(req.body, null, 2));
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const errors = result.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
        }));
        console.error('[validate] ❌ Validation failed. Fields:', errors);
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }
    req.body = result.data; // use sanitized/coerced data
    next();
};

module.exports = {
    validateRegister: validate(registerSchema),
    validateLogin: validate(loginSchema),
    validateForgotPassword: validate(forgotPasswordSchema),
    validateResetPassword: validate(resetPasswordSchema)
};
