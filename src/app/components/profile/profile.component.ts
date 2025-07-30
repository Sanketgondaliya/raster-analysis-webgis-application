import { Component, OnInit } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Select } from "primeng/select";
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
@Component({
  selector: 'app-profile',
  imports: [FormsModule, InputTextModule, Select, ReactiveFormsModule, ButtonModule, TextareaModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  value: string | undefined;
  ProjectForm!: FormGroup;
  ProjectNameList = [
    { label: 'Project A', value: 'projectA' },
    { label: 'Project B', value: 'projectB' },
  ];
  constructor(private fb: FormBuilder) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {

    this.ProjectForm = this.fb.group({
      selected_project: [null],
      project_name: [null, Validators.required],
      project_desc: [null],

    });
  }
  onSubmit(event: Event): void {
    event.preventDefault();
    const formValue = this.ProjectForm.value;

    const selectedProject = formValue.selected_project;
    const newProjectName = formValue.project_name;
    const newProjectDesc = formValue.project_desc;

    if (selectedProject) {
      console.log('Selected Project form:', selectedProject);
    } else if (newProjectName && newProjectDesc) {
      console.log('create form value:', newProjectName, newProjectDesc);
      // Handle creation of new project
    } else {
      console.log('form submit faild');
      // Show validation warning or message
    }
  }
}
