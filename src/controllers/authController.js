const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function register(req, res, next) {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      const e = new Error('username and password required');
      e.status = 400;
      throw e;
    }
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      const e = new Error('Username already taken');
      e.status = 409;
      throw e;
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashed,
      role: role === 'admin' || role === 'manager' ? role : 'manager',
    });
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      const e = new Error('username and password required');
      e.status = 400;
      throw e;
    }
    const user = await User.findOne({ where: { username } });
    if (!user) {
      const e = new Error('Invalid credentials');
      e.status = 401;
      throw e;
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      const e = new Error('Invalid credentials');
      e.status = 401;
      throw e;
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'username', 'role', 'createdAt'],
    });
    if (!user) {
      const e = new Error('User not found');
      e.status = 404;
      throw e;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
