import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FileUploadModule, FileUpload } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { GeoserverService } from '../services/geoserver.service';
import { Select } from 'primeng/select';
import { ToastService } from '../services/toast.service';

interface Tab {
  label: string;
  value: number;
}

@Component({
  selector: 'app-geoserver',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule, InputTextModule, FileUploadModule, PasswordModule, ReactiveFormsModule, Select, ButtonModule],
  templateUrl: './geoserver.component.html',
  styleUrl: './geoserver.component.scss'
})
export class GeoserverComponent {
  value: number = 1;
  selectedFile: File | null = null;
  datastoreForm!: FormGroup;
  ProjectNameList: { label: string; value: string }[] = [];
  selectedProject: string = '';
  layername: string = '';

  tabs: Tab[] = [
    { label: 'Datastore', value: 1 },
    { label: 'Upload Layer', value: 2 },
  ];
  constructor(private fb: FormBuilder, private geoserverService: GeoserverService, private cdr: ChangeDetectorRef, private toastService: ToastService) {
    this.selectedProject = localStorage.getItem('selectedProject') || ""
  }

  ngOnInit(): void {
    this.intForm();
    this.getProjectList();
  }

  intForm() {
    this.datastoreForm = this.fb.group({
      workspaceName: ['', Validators.required],
      dbHost: ['', Validators.required],
      dbPort: ['', Validators.required],
      dbName: ['', Validators.required],
      dbUser: ['', Validators.required],
      dbPassword: ['', Validators.required],
    });
  }

  getProjectList() {
    this.geoserverService.geoserverDataStoreList(this.selectedProject).subscribe({
      next: (response) => {
        const dataStores = response?.dataStores.dataStore || [];
        this.ProjectNameList = dataStores.map((ws: any) => ({
          label: ws.name,
          value: ws.name
        }));
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error("Error fetching data:", error);
        this.toastService.showError(error || 'Error fetching data')
      },
    });
  }

  onProjectSelectChange(): void {
    const selectedValue = this.selectedProject;
    if (selectedValue) {
      localStorage.setItem('selectedDataStore', selectedValue);
      const selectedOption = this.ProjectNameList.find(opt => opt.value === selectedValue);
    }
  }

  onTabChange(index: number | string): void {
    this.value = typeof index === 'string' ? parseInt(index, 10) : index;
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
      this.toastService.showWarn('Please select a file before saving.')
      return;
    }

    if (!selectedProject || !selectedDataStore) {
      this.toastService.showWarn('Missing project or datastore information.')
      return;
    }


    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('workspace', selectedProject);
    formData.append('datastore', selectedDataStore);
    formData.append('layerName', this.layername);

    this.geoserverService.geoserverUploadfile(formData).subscribe({
      next: (response) => {
        this.toastService.showSuccess(response.message || 'File uploaded successfully')
      },
      error: (error) => {
        this.toastService.showError(error.message || 'Upload fail')
        console.error('Upload error:', error);
      }
    });
  }


  onDatastoreSubmit(): void {
    const formValue = this.datastoreForm.value
    let payload = {
      workspaceName: formValue.workspaceName,
      dbHost: formValue.dbHost,
      dbPort: formValue.dbPort,
      dbName: formValue.dbName,
      dbUser: formValue.dbUser,
      dbPassword: formValue.dbPassword
    }
    if (this.datastoreForm.valid) {
      this.geoserverService.geoserverProject(payload).subscribe({
        next: (response) => {
          this.toastService.showSuccess(response.message || 'DataStored created successfully')
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error("Error creating DataStored:", error);
          this.toastService.showSuccess(error.message || 'DataStored created Fail')
        },
      });
    } else {
      this.datastoreForm.markAllAsTouched();
    }
  }
}
