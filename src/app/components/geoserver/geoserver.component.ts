import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { GeoserverService } from '../services/geoserver.service';
import { ToastService } from '../services/toast.service';

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
    { label: 'Datastore', value: 1 },
    { label: 'Upload Layer', value: 2 }
  ];

  datastoreForm!: FormGroup;
  ProjectNameList: { label: string; value: string }[] = [];
  selectedProject = '';
  selectedFile: File | null = null;
  layername = '';

  constructor(
    private fb: FormBuilder,
    private geoserverService: GeoserverService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.selectedProject = localStorage.getItem('selectedProject') || '';
  }

  ngOnInit(): void {
    this.initForm();
    this.getDatastoreList();
  }

  initForm(): void {
    this.datastoreForm = this.fb.group({
      datastorename: ['', Validators.required],
      dbHost: ['192.168.20.49', Validators.required],
      dbPort: ['5432', Validators.required],
      dbName: ['gisdb', Validators.required],
      dbUser: ['postgres', Validators.required],
      dbPassword: ['postgres', Validators.required]
    });
  }

  getDatastoreList(): void {
    if (!this.selectedProject) {
      this.toastService.showInfo('Please select a project first.');
      return;
    }

    this.geoserverService.geoserverDataStoreList(this.selectedProject).subscribe({
      next: (response) => {
        const dataStores = response?.dataStores?.dataStore || [];

        if (dataStores.length === 0) {
          this.ProjectNameList = [];
          this.toastService.showInfo('No datastores found. Please create one.');
          localStorage.removeItem('selectedDataStore');
        } else {
          this.ProjectNameList = dataStores.map((ws: any) => ({
            label: ws.name,
            value: ws.name
          }));

          if (this.ProjectNameList.length === 1) {
            this.selectedProject = this.ProjectNameList[0].value;
            localStorage.setItem('selectedDataStore', this.selectedProject);
          }
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error("Error fetching datastores:", error);
        // this.toastService.showError(error || 'Error fetching datastore list');
      }
    });
  }



  onTabChange(index: number | string): void {
    this.value = typeof index === 'string' ? parseInt(index, 10) : index;
    // 🔥 Refresh the list after successful creation
    this.getDatastoreList();
  }

  onProjectSelectChange(): void {
    if (this.selectedProject) {
      localStorage.setItem('selectedDataStore', this.selectedProject);
    }
  }

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
    const selectedProject = localStorage.getItem('selectedProject');
    const selectedDataStore = localStorage.getItem('selectedDataStore');

    if (!this.selectedFile) {
      this.toastService.showWarn('Please select a file before saving.');
      return;
    }

    if (!selectedProject || !selectedDataStore) {
      this.toastService.showWarn('Missing project or datastore information.');
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('workspace', selectedProject);
    formData.append('datastore', selectedDataStore);
    formData.append('layerName', this.layername);

    this.geoserverService.geoserverUploadfile(formData).subscribe({
      next: (response) => {
        this.toastService.showSuccess(response.message || 'File uploaded successfully');
        this.clearForm();
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.toastService.showError(error.message || 'Upload failed');
      }
    });
  }

  onDatastoreSubmit(): void {
    if (this.datastoreForm.invalid) {
      this.datastoreForm.markAllAsTouched();
      return;
    }

    const formValue = this.datastoreForm.value;
    const selectedProject = localStorage.getItem('selectedProject');

    const payload = {
      workspaceName: selectedProject,
      dbHost: formValue.dbHost,
      datastoreName: formValue.datastorename,
      dbPort: formValue.dbPort,
      dbName: formValue.dbName,
      dbUser: formValue.dbUser,
      dbPassword: formValue.dbPassword
    };

    this.geoserverService.geoserverDataStore(payload).subscribe({
      next: (response) => {
        this.toastService.showSuccess(response.message || 'Datastore created successfully');

        // 🔥 Refresh the list after successful creation
        this.getDatastoreList();

        // 🔄 Set the newly created datastore as selected
        this.selectedProject = formValue.datastorename;
        localStorage.setItem('selectedDataStore', this.selectedProject);

        // 👁️ Ensure UI reflects changes
        this.cdr.detectChanges();

        // Optionally clear form fields (excluding selectedProject)
        this.datastoreForm.reset();
        this.layername = '';
        this.selectedFile = null;
      },
      error: (error) => {
        console.error("Error creating datastore:", error);
        this.toastService.showError(error.message || 'Datastore creation failed');
      }
    });
  }

  clearForm(): void {
    this.datastoreForm.reset();
    this.selectedFile = null;
    this.layername = '';
    this.selectedProject = '';
    localStorage.removeItem('selectedDataStore');
    this.cdr.detectChanges();
  }
}
