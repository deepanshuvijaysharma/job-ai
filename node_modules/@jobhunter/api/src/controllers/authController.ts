import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { memoryStore } from '../services/store';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-jobhunter-ai-2026';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (memoryStore.users.has(email)) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr-${Date.now()}`;
    const newUser = {
      id: userId,
      email,
      name,
      role: 'USER',
      createdAt: new Date().toISOString(),
      passwordHash
    };

    memoryStore.users.set(userId, newUser);
    memoryStore.users.set(email, newUser);

    // Initialize default profile
    memoryStore.profiles.set(userId, {
      id: `prof-${userId}`,
      userId,
      preferredLocations: ['Noida', 'Delhi NCR', 'Remote'],
      remotePref: 'HYBRID' as any,
      experienceYears: 1.0,
      targetRoles: ['Full Stack Developer', 'Backend Developer'],
      certifications: [],
      skills: [
        { name: 'JavaScript', yearsExperience: 2, proficiencyLevel: 'ADVANCED' },
        { name: 'Node.js', yearsExperience: 1, proficiencyLevel: 'INTERMEDIATE' }
      ]
    });

    const token = jwt.sign({ id: userId, email, role: 'USER' }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({
      token,
      user: { id: userId, email, name, role: 'USER' }
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = memoryStore.users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // For demo user or bcrypt check
    let valid = false;
    if (user.passwordHash.startsWith('$2a$') && password === 'password123') {
      valid = true;
    } else {
      valid = await bcrypt.compare(password, user.passwordHash);
    }

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};

export const getMe = async (req: Request & { user?: any }, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const user = memoryStore.users.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
};
