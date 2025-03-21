import { defineStore } from 'pinia';

export const useTaskStore = defineStore('task', {
  state: () => ({
    selectedTask: null,
  }),
  actions: {
    setSelectedTask(task) {
      this.selectedTask = task;
    },
    updateCaseById(copy_case_id, data) {
      if (this.selectedTask) {
        const singleCase = (this.selectedTask.cases || []).find(c => c.copy_case_id === copy_case_id);
        if (singleCase) {
          Object.assign(singleCase, data);
          this.selectedTask.cases = [...this.selectedTask.cases];
          this.selectedTask = JSON.parse(JSON.stringify(this.selectedTask));
        }

      }
    }
  },
});