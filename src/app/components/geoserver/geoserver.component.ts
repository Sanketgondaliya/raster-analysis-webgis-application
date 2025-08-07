import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { GeoserverService } from '../../services/geoserver.service';
import { ToastService } from '../../services/toast.service';
import { MapService } from '../../services/map.service';
import { AbstractControl, ValidatorFn } from '@angular/forms';

interface Tab {
  label: string;
  value: number;
}

@Component({
  selector: 'app-geoserver',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabsModule,
    InputTextModule,
    FileUploadModule,
    PasswordModule,
    Select,
    ButtonModule,
  ],
  templateUrl: './geoserver.component.html',
  styleUrl: './geoserver.component.scss'
})
export class GeoserverComponent {
  value = 1;

  tabs: Tab[] = [
    { label: 'Geoserver Config', value: 1 },
    { label: 'Database Config', value: 2 },
    { label: 'Project Setup', value: 3 },
    { label: 'Department Setup', value: 4 },
    { label: 'Upload Data', value: 5 }
  ];

  geoserverConfig!: FormGroup;
  databaseConfig!: FormGroup;
  projectSetup!: FormGroup;
  departmentSetup!: FormGroup;

  publishLayerForm!: FormGroup;

  ProjectNameList: { label: string; value: string }[] = [];
  DepartmentList: { label: string; value: string }[] = [];
  selectedProject = '';
  selectedDataStore = '';

  selectedFile: File | null = null;
  layername = '';

  constructor(
    private fb: FormBuilder,
    private geoserverService: GeoserverService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.selectedProject = localStorage.getItem('selectedProject') || '';
    this.selectedDataStore = localStorage.getItem('selectedDataStore') || '';
  }

  ngOnInit(): void {
    this.initForms();
    this.getProjectList();
    // this.getDatastoreList();
  }

  initForms(): void {
    // Custom validator factory to allow only letters, numbers, underscore, hyphen, no spaces
    const nameValidator: ValidatorFn = (control: AbstractControl) => {
      const pattern = /^[a-zA-Z0-9_-]+$/;
      if (!control.value) return null; // allow empty - required handled separately
      return pattern.test(control.value) ? null : { invalidName: true };
    };

    // Custom validator for project name: allow letters and numbers only (no special chars or spaces)
    const projectNameValidator: ValidatorFn = (control: AbstractControl) => {
      const pattern = /^[a-zA-Z0-9]+$/;
      if (!control.value) return null;
      return pattern.test(control.value) ? null : { invalidProjectName: true };
    };

    const savedGeoConfig = localStorage.getItem('geoserverConfig');
    const geoConfig = savedGeoConfig ? JSON.parse(savedGeoConfig) : {
      geoserverurl: '',
      geoserverUsername: '',
      geoserverPassword: ''
    };
    this.geoserverConfig = this.fb.group({
      geoserverurl: [geoConfig.geoserverurl, Validators.required],
      geoserverUsername: [geoConfig.geoserverUsername, Validators.required],
      geoserverPassword: [geoConfig.geoserverPassword, Validators.required]
    });

    const savedDbConfig = localStorage.getItem('databaseConfig');
    const dbConfig = savedDbConfig ? JSON.parse(savedDbConfig) : {
      databaseHost: '',
      databasePort: '',
      databaseUsername: '',
      databasePassword: '',
      databaseDefaultDb: ''

    };
    this.databaseConfig = this.fb.group({
      databaseHost: [dbConfig.databaseHost, Validators.required],
      databasePort: [dbConfig.databasePort, Validators.required],
      databaseUsername: [dbConfig.databaseUsername, Validators.required],
      databasePassword: [dbConfig.databasePassword, Validators.required],
      databaseDefaultDb: [dbConfig.databaseDefaultDb, Validators.required]
    });

    this.projectSetup = this.fb.group({
      projectName: ['', [Validators.required, projectNameValidator]],
      projectDescription: ['']
    });

    this.departmentSetup = this.fb.group({
      datastorename: ['', [Validators.required, nameValidator]],
      selectedProject: [null, Validators.required]
    });

    this.publishLayerForm = this.fb.group({
      selectedProject: [this.selectedProject, Validators.required],
      selectedDataStore: [this.selectedDataStore, Validators.required],
      layername: ['', [Validators.required, nameValidator]]
    });
  }

  // ------------------- Tab Navigation ------------------
  onTabChange(index: number | string): void {
    this.value = typeof index === 'string' ? parseInt(index, 10) : index;
    this.getDatastoreList();
  }

  // ------------------- Submit Handlers ------------------
  geoserverConfigSumit(): void {
    if (this.geoserverConfig.invalid) {
      this.geoserverConfig.markAllAsTouched();
      this.toastService.showWarn('Please fill out the GeoServer config form properly.');
      return;
    }

    const formValue = this.geoserverConfig.value;
    const payload = {
      geoserverurl: formValue.geoserverurl,
      username: formValue.geoserverUsername,
      password: formValue.geoserverPassword
    };

    // Test GeoServer connection
    this.geoserverService.testGeoServerConnection(payload).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message || 'GeoServer connection successful!');
        localStorage.setItem('geoserverConfig', JSON.stringify(formValue));
        this.toastService.showSuccess('GeoServer Config Submitted and Saved!');
      },
      error: (err) => {
        const backendMessage = err?.error?.error || err?.error?.message || 'GeoServer connection failed!';
        this.toastService.showError(backendMessage);
        console.error('GeoServer connection failed:', err);
      }
    });
  }



  submitAndTestDatabaseConfig(): void {
    if (this.databaseConfig.invalid) {
      this.databaseConfig.markAllAsTouched();
      this.toastService.showWarn('Please fill out the database config form properly.');
      return;
    }

    const formValue = this.databaseConfig.value;

    const payload = {
      host: formValue.databaseHost,
      port: formValue.databasePort,
      user: formValue.databaseUsername,
      dbpassword: formValue.databasePassword,
      database: formValue.databaseDefaultDb
    };

    this.geoserverService.testDatabaseConnection(payload).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message || 'Database connection successful!');
        localStorage.setItem('databaseConfig', JSON.stringify(formValue));
        this.toastService.showSuccess('Database Config Submitted and Saved!');
      },
      error: (err) => {
        const backendMessage = err?.error?.error || err?.error?.message || 'Failed to connect to the database.';
        this.toastService.showError(backendMessage);
        console.error('Database connection failed:', err);
      }
    });
  }



  onProjectSubmit(): void {
    if (this.projectSetup.invalid) {
      this.projectSetup.markAllAsTouched();
      return;
    }
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');



    const ProjectData = this.projectSetup.value;
    this.toastService.showSuccess('Project Created!');
    const ProjectPayload = {
      workspaceName: ProjectData.projectName,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb
    };

    this.geoserverService.geoserverProjectCreate(ProjectPayload).subscribe({
      next: (response) => {
        this.toastService.showSuccess(response.message || 'Project created successfully');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastService.showError(error || 'Project creation failed');
        console.error("Error creating project:", error);
      },
    });
  }

  onDatastoreSubmit(): void {
    if (this.departmentSetup.invalid) {
      this.departmentSetup.markAllAsTouched();
      return;
    }
    const formValue = this.departmentSetup.value;
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');
    const payload = {
      datastoreName: formValue.datastorename,
      workspaceName: formValue.selectedProject,
      dbHost: databaseConfig.databaseHost,
      dbPort: databaseConfig.databasePort,
      dbUser: databaseConfig.databaseUsername,
      dbPassword: databaseConfig.databasePassword,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword
    };

    this.geoserverService.geoserverDataStoreCreate(payload).subscribe({
      next: (response) => {
        this.toastService.showSuccess(response.message || 'Datastore created successfully');
        this.getDatastoreList();

        this.selectedProject = formValue.datastorename;
        localStorage.setItem('selectedDataStore', this.selectedProject);

        this.layername = '';
        this.selectedFile = null;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastService.showError(error.message || 'Datastore creation failed');
      }
    });
  }

  // ------------------- Clear Handlers ------------------
  clearGeoserverForm(): void {
    this.geoserverConfig.reset();
    localStorage.removeItem('geoserverConfig');
  }


  clearDatabaseForm(): void {
    this.databaseConfig.reset();
    localStorage.removeItem('databaseConfig');
  }


  clearProjectForm(): void {
    this.projectSetup.reset();
  }

  clearDepartmentrForm(): void {
    this.departmentSetup.reset();
  }

  clearForm(): void {
    this.selectedFile = null;
    this.layername = '';
    this.selectedProject = '';
    this.cdr.detectChanges();
  }

  // ------------------- File Upload ------------------
  onFileSelect(event: any): void {
    const files = event.files;
    if (files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  onCustomUpload(event: any): void {
    console.log('Custom upload triggered:', event);
  }

  onSaveFileUpload(): void {
    if (this.publishLayerForm.invalid || !this.selectedFile) {
      this.publishLayerForm.markAllAsTouched();
      if (!this.selectedFile) {
        this.toastService.showWarn('Please select a file before saving.');
      }
      return;
    }
    const { selectedProject, selectedDataStore, layername } = this.publishLayerForm.value;
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('workspace', selectedProject);
    formData.append('datastore', selectedDataStore);
    formData.append('layerName', layername);
    formData.append('dbHost', databaseConfig.databaseHost);
    formData.append('dbPort', databaseConfig.databasePort);
    formData.append('dbUser', databaseConfig.databaseUsername);
    formData.append('dbPassword', databaseConfig.databasePassword);
    formData.append('geoserverurl', geoserverConfig.geoserverurl);
    formData.append('username', geoserverConfig.geoserverUsername);
    formData.append('password', geoserverConfig.geoserverPassword);

    this.geoserverService.geoserverUploadfile(formData).subscribe({
      next: (response) => {
        this.toastService.showSuccess(response.message || 'File uploaded successfully');
        this.clearForm();
      },
      error: (error) => {
        this.toastService.showError(error.message || 'Upload failed');
      }
    });
  }

  onProjectChange(event: any): void {
    const selectedProject = event.value;

    if (selectedProject) {
      this.getDatastoreListForProject(selectedProject);
      this.publishLayerForm.patchValue({ selectedDataStore: null }); // clear old selection
    } else {
      this.DepartmentList = [];
      this.publishLayerForm.patchValue({ selectedDataStore: null });
    }
  }
  getDatastoreListForProject(projectName: string): void {
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');
    this.toastService.showSuccess('Project Created!');
    const ProjectPayload = {
      projectName: projectName,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb
    };
    this.geoserverService.geoserverDataStoreList(ProjectPayload).subscribe({
      next: (response) => {
        const dataStores = response?.dataStores?.dataStore || [];

        this.DepartmentList = dataStores.map((ds: any) => ({
          label: ds.name,
          value: ds.name
        }));

        if (this.DepartmentList.length === 1) {
          this.publishLayerForm.patchValue({
            selectedDataStore: this.DepartmentList[0].value
          });
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastService.showError('Failed to fetch departments.');
        console.error('Datastore fetch error:', error);
      }
    });
  }

  // ------------------- Project & Datastore ------------------
  getDatastoreList(): void {
    if (!this.selectedProject) {
      this.toastService.showInfo('Please select a project first.');
      return;
    }
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
      database: databaseConfig.databaseDefaultDb
    };
    this.geoserverService.geoserverDataStoreList(ProjectPayload).subscribe({
      next: (response) => {
        const dataStores = response?.dataStores?.dataStore || [];
        if (dataStores.length === 0) {
          this.DepartmentList = [];
          localStorage.removeItem('selectedDataStore');
          this.toastService.showInfo('No datastores found. Please create one.');
        } else {
          this.DepartmentList = dataStores.map((ds: any) => ({
            label: ds.name,
            value: ds.name
          }));

          if (this.DepartmentList.length === 1) {
            this.selectedDataStore = this.DepartmentList[0].value;
            localStorage.setItem('selectedDataStore', this.selectedDataStore);
          }
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastService.showError('Error fetching datastore list');
      }
    });
  }
  getProjectList() {
    this.geoserverService.geoserverProjectList().subscribe({
      next: (response) => {
        const workspaces = response?.workspaces?.workspace || [];
        if (workspaces.length === 0) {
          this.ProjectNameList = [];
          this.toastService.showInfo('No projects found. Please create a project first.');
        } else {
          this.ProjectNameList = workspaces.map((ws: any) => ({
            label: ws.name,
            value: ws.name
          }));
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error("Error fetching data:", error);
        this.toastService.showError(error || 'Error fetching data');
      },
    });
  }
}

