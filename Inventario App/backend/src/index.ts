import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));

app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'ISP Hub-and-Spoke Inventory API',
    wisproIntegration: 'active'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ISP Inventory API escuchando en http://localhost:${PORT}`);
  console.log(`📦 Endpoints disponibles en http://localhost:${PORT}/api`);
});
