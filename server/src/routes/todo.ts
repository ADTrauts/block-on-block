import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as todoController from '../controllers/todoController';
import * as todoAIContextController from '../controllers/todoAIContextController';
import { multerUpload } from '../controllers/fileController';

const todoRouter: Router = Router();

// All routes require authentication
todoRouter.use(authenticateJWT);

// Main CRUD routes
todoRouter.get('/tasks', todoController.getTasks);
todoRouter.post('/tasks', todoController.createTask);
todoRouter.get('/tasks/:id', todoController.getTaskById);
todoRouter.put('/tasks/:id', todoController.updateTask);
todoRouter.delete('/tasks/:id', todoController.deleteTask);

// Task actions
todoRouter.post('/tasks/:id/complete', todoController.completeTask);
todoRouter.post('/tasks/:id/reopen', todoController.reopenTask);

// Calendar event linking
todoRouter.post('/tasks/:id/create-event', todoController.createEventFromTask);
todoRouter.post('/tasks/:id/link-event', todoController.linkTaskToEvent);
todoRouter.delete('/tasks/:id/unlink-event/:eventId', todoController.unlinkTaskFromEvent);
todoRouter.get('/tasks/:id/linked-events', todoController.getTaskLinkedEvents);

// Drive file linking
todoRouter.post('/tasks/:id/link-file', todoController.linkTaskToFile);
todoRouter.delete('/tasks/:id/unlink-file/:fileId', todoController.unlinkTaskFromFile);
todoRouter.get('/tasks/:id/linked-files', todoController.getTaskLinkedFiles);

// Task comments
todoRouter.post('/tasks/:id/comments', todoController.createTaskComment);
todoRouter.put('/tasks/:id/comments/:commentId', todoController.updateTaskComment);
todoRouter.delete('/tasks/:id/comments/:commentId', todoController.deleteTaskComment);

// Task subtasks
todoRouter.post('/tasks/:id/subtasks', todoController.createSubtask);
todoRouter.put('/tasks/:id/subtasks/:subtaskId', todoController.updateSubtask);
todoRouter.delete('/tasks/:id/subtasks/:subtaskId', todoController.deleteSubtask);
todoRouter.post('/tasks/:id/subtasks/:subtaskId/complete', todoController.completeSubtask);

// Task attachments
todoRouter.post('/tasks/:id/attachments', multerUpload, todoController.uploadTaskAttachment);
todoRouter.get('/tasks/:id/attachments/:attachmentId/serve', todoController.serveTaskAttachment);
todoRouter.delete('/tasks/:id/attachments/:attachmentId', todoController.deleteTaskAttachment);

// Task dependencies
todoRouter.post('/tasks/:id/dependencies', todoController.addTaskDependency);
todoRouter.delete('/tasks/:id/dependencies/:dependsOnTaskId', todoController.removeTaskDependency);
todoRouter.get('/tasks/:id/dependencies', todoController.getTaskDependencies);

// Task projects
todoRouter.get('/projects', todoController.getProjects);
todoRouter.post('/projects', todoController.createProject);
todoRouter.put('/projects/:id', todoController.updateProject);
todoRouter.delete('/projects/:id', todoController.deleteProject);

// Task recurrence
todoRouter.post('/tasks/:id/generate-instances', todoController.generateRecurringInstances);
todoRouter.get('/tasks/:id/recurrence-description', todoController.getRecurrenceDescription);

// Time tracking
todoRouter.post('/tasks/:id/timer/start', todoController.startTimer);
todoRouter.post('/tasks/:id/timer/stop', todoController.stopTimer);
todoRouter.get('/timer/active', todoController.getActiveTimer);
todoRouter.post('/tasks/:id/time-logs', todoController.logTime);
todoRouter.get('/tasks/:id/time-logs', todoController.getTimeLogs);
todoRouter.put('/tasks/:id/time-logs/:logId', todoController.updateTimeLog);
todoRouter.delete('/tasks/:id/time-logs/:logId', todoController.deleteTimeLog);

// AI Context Provider Endpoints
todoRouter.get('/ai/context/overview', todoAIContextController.getOverviewContext);
todoRouter.get('/ai/context/upcoming', todoAIContextController.getUpcomingContext);
todoRouter.get('/ai/context/overdue', todoAIContextController.getOverdueContext);
todoRouter.get('/ai/context/priority', todoAIContextController.getPriorityContext);
todoRouter.get('/ai/context/priority-analysis', todoAIContextController.getPriorityAnalysisContext);

// AI Prioritization Endpoints
todoRouter.get('/ai/prioritize/suggestions', todoController.getPrioritySuggestions);
todoRouter.post('/ai/prioritize/analyze', todoController.analyzeTaskPriorities);
todoRouter.post('/ai/prioritize/execute', todoController.executePriorityChanges);
todoRouter.post('/ai/prioritize/feedback', todoController.submitPriorityFeedback);

// AI Smart Scheduling Endpoints
todoRouter.get('/ai/schedule/suggestions', todoController.getSchedulingSuggestions);
todoRouter.post('/ai/schedule/analyze', todoController.analyzeTaskScheduling);
todoRouter.post('/ai/schedule/execute', todoController.executeSchedulingChanges);

// Chat Integration Endpoints
todoRouter.post('/chat/create-task', todoController.createTaskFromMessage);
todoRouter.post('/chat/parse-message', todoController.parseMessageForTask);
todoRouter.get('/chat/conversation/:conversationId/tasks', todoController.getTasksForConversation);

export default todoRouter;
