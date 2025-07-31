import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Select } from "primeng/select";
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { GeoserverService } from '../services/geoserver.service';
import { ToastService } from '../services/toast.service';
@Component({
  selector: 'app-profile',
  imports: [FormsModule, InputTextModule, Select, ReactiveFormsModule, ButtonModule, TextareaModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  value: string | undefined;
  ProjectForm!: FormGroup;
  selectedProject: string | null = null;
  ProjectNameList: { label: string; value: string }[] = [];

  constructor(private fb: FormBuilder, private geoserverService: GeoserverService, private cdr: ChangeDetectorRef, private toastService: ToastService) { }

  ngOnInit(): void {
    this.initForm();
    this.getProjectList();

    // Get stored value from localStorage and set selectedProject
    const storedProject = localStorage.getItem('selectedProject');
    if (storedProject) {
      this.selectedProject = storedProject;
    }
  }

  initForm() {
    this.ProjectForm = this.fb.group({
      selected_project: [null],
      project_name: [null, Validators.required],
      project_desc: [null],
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


  onProjectSelectChange(): void {
    const selectedValue = this.selectedProject;
    if (selectedValue) {
      localStorage.setItem('selectedProject', selectedValue);
      const selectedOption = this.ProjectNameList.find(opt => opt.value === selectedValue);
    }
  }

  onSubmit(event: Event): void {
    event.preventDefault();

    if (this.ProjectForm.invalid) return;

    const formValue = this.ProjectForm.value;
    const newProjectName = formValue.project_name;

    const payload = {
      workspaceName: newProjectName
    };

    this.geoserverService.geoserverProject(payload).subscribe({
      next: (response) => {
        // ✅ Show success
        this.toastService.showSuccess(response.message || 'Project created successfully');

        // ✅ Store in localStorage
        localStorage.setItem('selectedProject', newProjectName ?? '');

        // ✅ Refresh project list (optional)
        this.getProjectList();

        // ✅ Reset form
        this.ProjectForm.reset();
        this.cdr.detectChanges(); // Optional: force change detection if needed
      },
      error: (error) => {
        this.toastService.showError(error || 'Project creation failed');
        console.error("Error creating project:", error);
      },
    });
  }


}
