import { Routes } from '@angular/router';
import { LayerSwitchderComponent } from './components/layer-switchder/layer-switchder.component';
import { AttributeTableComponent } from './components/attribute-table/attribute-table.component';
import { QueryModuleComponent } from './components/query-module/query-module.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { GeoserverComponent } from './components/geoserver/geoserver.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'layer-switcher', component: LayerSwitchderComponent },
  { path: 'attribute-table', component: AttributeTableComponent },
  { path: 'query-module', component: QueryModuleComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'geoserver', component: GeoserverComponent },
  { path: '**', redirectTo: 'layer-switcher' }
];
