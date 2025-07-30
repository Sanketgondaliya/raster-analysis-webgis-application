import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FileUploadModule, FileUpload } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';

interface Tab {
  label: string;
  value: number;
}

@Component({
  selector: 'app-geoserver',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule, InputTextModule, FileUploadModule, PasswordModule, ReactiveFormsModule, ButtonModule],
  templateUrl: './geoserver.component.html',
  styleUrl: './geoserver.component.scss'
})
export class GeoserverComponent {
  value: number = 0;
  selectedFile: File | null = null;
  datastoreForm!: FormGroup;

  tabs: Tab[] = [
    { label: 'Workspace', value: 0 },
    { label: 'Datastore', value: 1 },
    { label: 'Upload Layer', value: 2 },
    // { label: 'Style', value: 3 }
  ];
  constructor(private fb: FormBuilder) { }

  ngOnInit(): void {
    this.intForm()
  }

  intForm() {
    this.datastoreForm = this.fb.group({
      department: ['', Validators.required],
      host: ['', Validators.required],
      port: ['', Validators.required],
      dbname: ['', Validators.required],
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  onTabChange(index: number | string): void {
    this.value = typeof index === 'string' ? parseInt(index, 10) : index;
    console.log('Tab Changed:', index);
  }
  onFileSelect(event: any): void {
    const files = event.files;
    if (files.length > 0) {
      this.selectedFile = files[0];
      console.log('File selected:', this.selectedFile);
    }
  }

  onCustomUpload(event: any): void {
    // If using custom upload handler (optional)
    console.log('Custom upload triggered:', event);
  }

  onSave(): void {
    if (!this.selectedFile) {
      alert('Please select a file before saving.');
      return;
    }

    console.log('Saving file:', this.selectedFile.name);
    // Here you can trigger your API call or service to upload
  }

  onDatastoreSubmit(): void {
    if (this.datastoreForm.valid) {
      console.log('Datastore Form:', this.datastoreForm.value);
    } else {
      this.datastoreForm.markAllAsTouched();
    }
  }
}
