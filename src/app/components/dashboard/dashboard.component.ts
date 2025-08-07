import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { Select } from 'primeng/select';
import { ToastService } from '../services/toast.service';
import { GeoserverService } from '../services/geoserver.service';
import { ChartConfiguration, ChartType, ChartOptions } from 'chart.js';
import { ChartTypeRegistry } from 'chart.js';
import {
  Chart,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Title,
  Tooltip,
  LineController,
  LineElement,
  PointElement,
  PieController
} from 'chart.js';
interface Table {
  name: string;
  bbox: any;
}

interface DataStore {
  name: string;
  tables: Table[];
}
Chart.register(
  ArcElement,
  PieController,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Title,
  Tooltip,
  LineController,
  LineElement,
  PointElement
);
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule, Select],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  activeTabIndex = 0;

  datastorelist: DataStore[] = [];
  selectedTables: { [dsName: string]: Table } = {};
  selectedColumns: { [dsName: string]: { x?: string; y?: string } } = {};
  selectedChartTypes: { [dsName: string]: string } = {};

  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false
  };
  analysisTypes = [
    { label: 'Count', value: 'count' },
    { label: 'Sum', value: 'sum' },
    { label: 'Average', value: 'avg' },
    { label: 'Minimum', value: 'min' },
    { label: 'Maximum', value: 'max' },
    { label: 'Distinct Count', value: 'distinct' }
  ];

  selectedAnalysisType: string = ''; // Just a single value

  dataTypeSupportChart = {
    numeric: ["smallint", "integer", "bigint", "decimal", "numeric", "real", "double precision", "serial", "bigserial"],
    string: ["character varying", "varchar", "character", "char", "text"]
  };

  chartTypes = [
    { label: 'Pie Chart', value: 'pie' as ChartType },
    { label: 'Bar Chart', value: 'bar' as ChartType },
    { label: 'Column Chart', value: 'column' as any },
    { label: 'Line Chart', value: 'line' as ChartType }
  ];

  xAxisOptions: { [dsName: string]: string[] } = {};
  yAxisOptions: { [dsName: string]: string[] } = {};

  selectedProject: string;
  selectedDataStore: string;

  columnsMap: {
    [dsName: string]: {
      [tableName: string]: { column_name: string; data_type: string }[];
    };
  } = {};

  private charts: { [key: string]: Chart } = {};

  chartDataMap: { [dsName: string]: ChartConfiguration['data'] } = {};

  constructor(
    private toastService: ToastService,
    private geoserverService: GeoserverService
  ) {
    this.selectedProject = localStorage.getItem('selectedProject') || '';
    this.selectedDataStore = localStorage.getItem('selectedDataStore') || '';
  }

  ngOnInit(): void {
    this.getDatastoreList();
  }

  getDatastoreList(): void {
    const selectedProject = localStorage.getItem('selectedProject') || '';
    if (!selectedProject) {
      this.toastService.showInfo('Please select a project first.');
      return;
    }

    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');

    const ProjectPayload = {
      workspaceName: selectedProject,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb
    };

    this.geoserverService.geoserverLayerList(ProjectPayload).subscribe({
      next: (response) => {
        this.datastorelist = response?.datastores || [];
      },
      error: (err) => {
        console.error('Error fetching datastore list:', err);
        this.toastService.showError('Failed to fetch datastore list.');
      }
    });
  }


  handleTableSelect(dsName: string): void {
    this.selectedColumns[dsName] = { x: undefined, y: undefined };
    this.selectedChartTypes[dsName] = '';
  }

  onChartTypeChange(dsName: string): void {
    const table = this.selectedTables[dsName]?.name;
    let chartType = this.selectedChartTypes[dsName];

    if (chartType === 'column') {
      chartType = 'bar';
    }

    if (!table || !this.columnsMap[dsName]?.[table] || !chartType) {
      this.xAxisOptions[dsName] = [];
      this.yAxisOptions[dsName] = [];
      return;
    }

    const columnMeta = this.columnsMap[dsName][table];
    const numeric = this.dataTypeSupportChart.numeric;
    const string = this.dataTypeSupportChart.string;

    this.xAxisOptions[dsName] = columnMeta
      .filter(col => {
        const type = col.data_type.toLowerCase();
        if (['bar', 'line'].includes(chartType)) {
          return string.includes(type); // X-axis: string
        } else if (chartType === 'pie') {
          return string.includes(type); // X-axis: string
        }
        return true;
      })
      .map(col => col.column_name);

    this.yAxisOptions[dsName] = columnMeta
      .filter(col => {
        const type = col.data_type.toLowerCase();
        if (['bar', 'line'].includes(chartType)) {
          return numeric.includes(type); // Y-axis: numeric
        } else if (chartType === 'pie') {
          return numeric.includes(type); // Y-axis: numeric
        }
        return true;
      })
      .map(col => col.column_name);

    if (this.selectedColumns[dsName]) {
      this.selectedColumns[dsName].x = undefined;
      this.selectedColumns[dsName].y = undefined;
    }
  }

  generateChartData(dsName: string): void {
    const selected = this.selectedColumns[dsName];
    const table = this.selectedTables[dsName];
    const chartType = this.selectedChartTypes[dsName];
    if (!selected?.x || !selected?.y || !table) {
      this.toastService.showInfo('Please select X-axis, Y-axis columns and chart type first.');
      return;
    }

    const dbName = this.selectedProject;
    const schemaName = dsName;
    const tableName = table.name;
    const xColumn = selected.x!;
    const yColumn = selected.y!;
    const analysisType = this.selectedAnalysisType;
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');
    this.toastService.showSuccess('Project Created!');
    const ProjectPayload = {
      projectName: this.selectedProject,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb,
      xColumn:xColumn,
      yColumn:yColumn,
      chartType:chartType,
      analysisType:analysisType,
      tableName:tableName,
      schemaName:schemaName,
      dbName:dbName
    };
    this.geoserverService.getChartData(ProjectPayload).subscribe({
      next: (response:any) => {
        const labels = response.data.map((item: { label: any; }) => item.label);
        const data = response.data.map((item: { value: any; }) => Number(item.value));


        // Update chartDataMap to show canvas
        this.chartDataMap[dsName] = {
          labels,
          datasets: [{
            label: `${yColumn} vs ${xColumn}`,
            data,
            backgroundColor: [
              '#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#FF7043',
            ],
          }],
        };

        const canvasId = `chartCanvas-${dsName}`;
        const canvas: any = document.getElementById(canvasId);
        const ctx = canvas?.getContext('2d');

        if (ctx) {
          if (this.charts[dsName]) {
            this.charts[dsName].destroy();
          }

          const chartJsType = (chartType === 'column' ? 'bar' : chartType) as keyof ChartTypeRegistry;

          this.charts[dsName] = new Chart(ctx, {
            type: chartJsType,
            data: this.chartDataMap[dsName],
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `${chartType.toUpperCase()} Chart` },
              }
            }
          });
        }
      },
      error: (err) => {
        console.error('Error loading chart data', err);
        this.toastService.showError('Failed to load chart data.');
      }
    });
  }

  onTableChange(schemaName: string, table: any) {
    const tableName = typeof table === 'string' ? table : table?.name;
    if (!tableName) return;
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');
    this.toastService.showSuccess('Project Created!');
    const ProjectPayload = {
      projectName: this.selectedProject,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb,
      schemaName: schemaName,
      dbName: this.selectedProject,
      tableName: tableName
    };
    this.geoserverService.getColumnsByTable(ProjectPayload)
      .subscribe((data: { columns: { column_name: string; data_type: string }[] }) => {
        const supportedTypes = [
          ...this.dataTypeSupportChart.numeric,
          ...this.dataTypeSupportChart.string
        ];
        debugger
        if (!data.columns) return;
        const filtered = data.columns.filter(col =>
          col.column_name && supportedTypes.includes(col.data_type.toLowerCase())
        );

        if (!this.columnsMap[schemaName]) {
          this.columnsMap[schemaName] = {};
        }

        this.columnsMap[schemaName][tableName] = filtered;
      });
  }
}
