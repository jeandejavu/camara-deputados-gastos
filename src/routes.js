import { Router } from 'express';
import MainController from './app/controllers/MainController';

const routes = new Router();

routes.get('/', MainController.hello);

export default routes;
