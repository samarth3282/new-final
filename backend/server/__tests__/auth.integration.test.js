const request = require('supertest');
const bcrypt = require('bcrypt');

const mockBlacklist = new Set();
const mockUsers = [];

const cloneUser = (user) => {
    if (!user) return null;

    return {
        ...user,
        save: async function save() {
            const idx = mockUsers.findIndex(u => u._id === this._id);
            if (idx !== -1) {
                mockUsers[idx] = { ...mockUsers[idx], ...this };
            }
            return cloneUser(mockUsers[idx]);
        }
    };
};

jest.mock('../Models/User', () => ({
    create: jest.fn(async (payload) => {
        const created = {
            _id: String(mockUsers.length + 1),
            ...payload,
            isVerified: payload.isVerified ?? false
        };
        mockUsers.push(created);
        return cloneUser(created);
    }),
    findOne: jest.fn(async (query) => {
        if (query.$or) {
            const found = mockUsers.find(u => query.$or.some(c => (c.username && u.username === c.username) || (c.email && u.email === c.email)));
            return cloneUser(found);
        }
        if (query.email) {
            return cloneUser(mockUsers.find(u => u.email === query.email));
        }
        if (query.username) {
            return cloneUser(mockUsers.find(u => u.username === query.username));
        }
        return null;
    }),
    findById: jest.fn(async (id) => cloneUser(mockUsers.find(u => u._id === id))),
    findByIdAndUpdate: jest.fn(async (id, update) => {
        const idx = mockUsers.findIndex(u => u._id === id);
        if (idx === -1) return null;
        mockUsers[idx] = { ...mockUsers[idx], ...update };
        return cloneUser(mockUsers[idx]);
    })
}));

jest.mock('../utils/sendEmail', () => jest.fn(async () => { }));
jest.mock('../utils/tokenBlacklist', () => ({
    addToBlacklist: jest.fn(async (token) => {
        mockBlacklist.add(token);
    }),
    isBlacklisted: jest.fn(async (token) => mockBlacklist.has(token)),
    connectRedis: jest.fn(async () => { })
}));

const sendEmail = require('../utils/sendEmail');
const User = require('../Models/User');
const { createApp } = require('../server');

describe('Auth integration', () => {
    let app;

    beforeAll(async () => {
        process.env.JWT_SECRET_KEY = 'test-access-secret-123';
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123';
        process.env.CLIENT_URL = 'http://localhost:5173';
        process.env.EMAIL_HOST = 'smtp.example.com';
        process.env.EMAIL_USER = 'user@example.com';
        process.env.EMAIL_PASS = 'pass';
        process.env.EMAIL_PORT = '587';
        process.env.EMAIL_SECURE = 'false';

        app = createApp();
    });

    afterEach(() => {
        mockBlacklist.clear();
        mockUsers.length = 0;
        jest.clearAllMocks();
    });

    it('stores hashed verification token and verifies account from email link', async () => {
        const registerRes = await request(app)
            .post('/api/register')
            .send({
                username: 'john_doe',
                email: 'john@example.com',
                password: 'Str0ng!Pass'
            });

        expect(registerRes.status).toBe(201);
        expect(sendEmail).toHaveBeenCalledTimes(1);

        const user = await User.findOne({ username: 'john_doe' });
        expect(user).toBeTruthy();
        expect(user.verificationToken).toBeTruthy();

        const html = sendEmail.mock.calls[0][2];
        const link = html.match(/https?:\/\/[^\s"<]+/)[0];
        const url = new URL(link);
        const token = url.searchParams.get('token');
        const id = url.searchParams.get('id');

        expect(token).toBeTruthy();
        expect(user.verificationToken).not.toBe(token);

        const verifyRes = await request(app)
            .get('/api/verify-email')
            .query({ token, id });

        expect(verifyRes.status).toBe(200);

        const verifiedUser = await User.findById(id);
        expect(verifiedUser.isVerified).toBe(true);
    });

    it('allows login with email and rotates refresh token on refresh', async () => {
        await request(app)
            .post('/api/register')
            .send({
                username: 'alice',
                email: 'alice@example.com',
                password: 'Str0ng!Pass'
            });

        const html = sendEmail.mock.calls[0][2];
        const link = html.match(/https?:\/\/[^\s"<]+/)[0];
        const url = new URL(link);
        await request(app)
            .get('/api/verify-email')
            .query({ token: url.searchParams.get('token'), id: url.searchParams.get('id') });

        const loginRes = await request(app)
            .post('/api/login')
            .send({ identifier: 'alice@example.com', password: 'Str0ng!Pass' });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.accessToken).toBeTruthy();
        const firstCookie = loginRes.headers['set-cookie'][0];
        expect(firstCookie).toContain('refreshToken=');

        const refreshRes = await request(app)
            .post('/api/refresh-token')
            .set('Cookie', firstCookie);

        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.accessToken).toBeTruthy();

        const rotatedCookie = refreshRes.headers['set-cookie'][0];
        expect(rotatedCookie).toContain('refreshToken=');
        expect(rotatedCookie).not.toBe(firstCookie);

        const replayRes = await request(app)
            .post('/api/refresh-token')
            .set('Cookie', firstCookie);

        expect(replayRes.status).toBe(401);
    });

    it('stores hashed reset token and resets password', async () => {
        await request(app)
            .post('/api/register')
            .send({
                username: 'bob',
                email: 'bob@example.com',
                password: 'Str0ng!Pass'
            });

        const verifyHtml = sendEmail.mock.calls[0][2];
        const verifyLink = verifyHtml.match(/https?:\/\/[^\s"<]+/)[0];
        const verifyUrl = new URL(verifyLink);

        await request(app)
            .get('/api/verify-email')
            .query({ token: verifyUrl.searchParams.get('token'), id: verifyUrl.searchParams.get('id') });

        await request(app)
            .post('/api/forgot-password')
            .send({ email: 'bob@example.com' });

        const resetHtml = sendEmail.mock.calls[1][2];
        const resetLink = resetHtml.match(/https?:\/\/[^\s"<]+/)[0];
        const resetUrl = new URL(resetLink);

        const user = await User.findById(resetUrl.searchParams.get('id'));
        const plainToken = resetUrl.searchParams.get('token');
        expect(user.resetPasswordToken).toBeTruthy();
        expect(user.resetPasswordToken).not.toBe(plainToken);

        const resetRes = await request(app)
            .post('/api/reset-password')
            .query({ token: plainToken, id: resetUrl.searchParams.get('id') })
            .send({ newPassword: 'N3w!StrongPass' });

        expect(resetRes.status).toBe(200);

        const relogin = await request(app)
            .post('/api/login')
            .send({ identifier: 'bob', password: 'N3w!StrongPass' });

        expect(relogin.status).toBe(200);

        const updated = await User.findOne({ username: 'bob' });
        const canLoginWithHash = await bcrypt.compare('N3w!StrongPass', updated.password);
        expect(canLoginWithHash).toBe(true);
    });
});
