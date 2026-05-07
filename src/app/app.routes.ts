import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Home } from './home/home';
import { Me } from './me/me';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'home', component: Home },
  { path: 'me', component: Me },
];
