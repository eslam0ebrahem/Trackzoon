import { authMiddleware, generateToken } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const checkAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

const verify = async () => {
    logger.info('Verifying Auth Fix...');

    // 1. Test Valid Admin Token
    const adminToken = generateToken({ role: 'admin' });
    const adminReq = { headers: { authorization: `Bearer ${adminToken}` } };
    const adminRes = mockRes();

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Run authMiddleware
    authMiddleware(adminReq, adminRes, () => {
        // Run checkAdmin
        checkAdmin(adminReq, adminRes, next);
    });

    if (nextCalled && adminReq.user.role === 'admin') {
        logger.info('✅ Admin Access: PASSED');
    } else {
        logger.error('❌ Admin Access: FAILED');
        logger.error(JSON.stringify(adminRes.data));
    }

    // 2. Test Non-Admin Token
    const userToken = generateToken({ role: 'user' });
    const userReq = { headers: { authorization: `Bearer ${userToken}` } };
    const userRes = mockRes();
    nextCalled = false;

    authMiddleware(userReq, userRes, () => {
        checkAdmin(userReq, userRes, next);
    });

    if (!nextCalled && userRes.statusCode === 403) {
        logger.info('✅ User Access Denied: PASSED');
    } else {
        logger.error('❌ User Access Denied: FAILED');
    }

    // 3. Test Missing Token
    const noTokenReq = { headers: {} };
    const noTokenRes = mockRes();
    nextCalled = false;

    authMiddleware(noTokenReq, noTokenRes, next);

    if (!nextCalled && noTokenRes.statusCode === 401) {
        logger.info('✅ Missing Token Denied: PASSED');
    } else {
        logger.error('❌ Missing Token Denied: FAILED');
    }
};

verify();
