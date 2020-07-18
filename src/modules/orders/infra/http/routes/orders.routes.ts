import { Router } from 'express';

import OrdersController from '../controller/OrdersController';

const ordersRouter = Router();
const ordersController = new OrdersController();

ordersRouter.post('/', ordersController.create);
ordersRouter.get('/:order_id', ordersController.show);

export default ordersRouter;
