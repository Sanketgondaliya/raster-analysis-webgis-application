import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-attribute-table',
  standalone: true,
  imports: [CommonModule, TabsModule, TableModule],
  templateUrl: './attribute-table.component.html',
  styleUrl: './attribute-table.component.scss'
})
export class AttributeTableComponent {
 tabs: {
  label: string;
  value: string;
  columns: { field: string; header: string }[];
  data: any[]; // <- Fix here
}[] = [
  {
    label: 'Users',
    value: 'users',
    columns: [
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' }
    ],
    data: [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' }
    ]
  },
  {
    label: 'Orders',
    value: 'orders',
    columns: [
      { field: 'orderId', header: 'Order ID' },
      { field: 'amount', header: 'Amount' }
    ],
    data: [
      { orderId: 1001, amount: 250 },
      { orderId: 1002, amount: 400 }
    ]
  }
];


  selectedTab = this.tabs[0].value;

  onTabChange(value: string | number): void {
    this.selectedTab = String(value);
    console.log('Selected Tab:', this.selectedTab);
  }
}
