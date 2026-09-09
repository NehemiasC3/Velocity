import { Router } from 'express';
import authRoutes from './authRoutes';
import syncRoutes from './syncRoutes';
import wisproRoutes from './wisproRoutes';
import inventoryRoutes from './inventoryRoutes';
import reportRoutes from './reportRoutes';
import notificationRoutes from './notificationRoutes';
import systemRoutes from './systemRoutes';

const apiRouter = Router();

apiRouter.use(authRoutes);
apiRouter.use(syncRoutes);
apiRouter.use(wisproRoutes);
apiRouter.use(reportRoutes);
apiRouter.use(systemRoutes);
apiRouter.use('/v1', inventoryRoutes);
apiRouter.use('/v1', notificationRoutes);

export default apiRouter;
