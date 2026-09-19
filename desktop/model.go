package main

import "time"

type Repo struct {
	Name          string    `json:"name"`
	FullName      string    `json:"fullName"`
	Visibility    string    `json:"visibility"`
	Private       bool      `json:"private"`
	Archived      bool      `json:"archived"`
	DefaultBranch string    `json:"defaultBranch"`
	HTMLURL       string    `json:"htmlUrl"`
	UpdatedAt     time.Time `json:"updatedAt,omitempty"`
	PushedAt      time.Time `json:"pushedAt,omitempty"`
	OpenIssues    int       `json:"openIssues"`
	Stars         int       `json:"stars"`
	Domain        string    `json:"domain"`
	Source        string    `json:"source"`
}

type ActivityItem struct {
	Type      string    `json:"type"`
	Repo      string    `json:"repo"`
	Title     string    `json:"title"`
	Actor     string    `json:"actor,omitempty"`
	State     string    `json:"state,omitempty"`
	URL       string    `json:"url,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	SHA       string    `json:"sha,omitempty"`
}

type WorkflowRun struct {
	Repo       string    `json:"repo"`
	Name       string    `json:"name"`
	Event      string    `json:"event"`
	Status     string    `json:"status"`
	Conclusion string    `json:"conclusion"`
	Branch     string    `json:"branch"`
	SHA        string    `json:"sha"`
	URL        string    `json:"url"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type GitHubSnapshot struct {
	ObservedAt         time.Time      `json:"observedAt"`
	Source             string         `json:"source"`
	Authenticated      bool           `json:"authenticated"`
	Identity           string         `json:"identity,omitempty"`
	Repos              []Repo         `json:"repos"`
	Activities         []ActivityItem `json:"activities"`
	WorkflowRuns       []WorkflowRun  `json:"workflowRuns"`
	OpenPRs            int            `json:"openPrs"`
	OpenIssues         int            `json:"openIssues"`
	Commits24h         int            `json:"commits24h"`
	Commits7d          int            `json:"commits7d"`
	PRsUpdated24h      int            `json:"prsUpdated24h"`
	IssuesUpdated24h   int            `json:"issuesUpdated24h"`
	CISuccess24h       int            `json:"ciSuccess24h"`
	CIFailure24h       int            `json:"ciFailure24h"`
	RateLimitRemaining int            `json:"rateLimitRemaining"`
	RateLimitReset     time.Time      `json:"rateLimitReset,omitempty"`
	RequestCount       int            `json:"requestCount,omitempty"`
	RetryCount         int            `json:"retryCount,omitempty"`
	BackoffCount       int            `json:"backoffCount,omitempty"`
	LastErrorClass     string         `json:"lastErrorClass,omitempty"`
	ReconcileSeconds   int            `json:"reconcileSeconds,omitempty"`
	ObservationMode    string         `json:"observationMode,omitempty"`
	Errors             []string       `json:"errors,omitempty"`
}

type MetricSample struct {
	Name       string            `json:"name"`
	Value      float64           `json:"value"`
	Unit       string            `json:"unit,omitempty"`
	Domain     string            `json:"domain,omitempty"`
	Source     string            `json:"source"`
	Evidence   string            `json:"evidence,omitempty"`
	ObservedAt time.Time         `json:"observedAt"`
	Labels     map[string]string `json:"labels,omitempty"`
}

type ProbeConfig struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	URL     string `json:"url"`
	Domain  string `json:"domain"`
	Enabled bool   `json:"enabled"`
}

type ProbeResult struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	URL        string    `json:"url"`
	Domain     string    `json:"domain"`
	Status     string    `json:"status"`
	HTTPStatus int       `json:"httpStatus,omitempty"`
	LatencyMs  int64     `json:"latencyMs,omitempty"`
	ObservedAt time.Time `json:"observedAt"`
	Error      string    `json:"error,omitempty"`
}

type Settings struct {
	GitHubOrg              string            `json:"githubOrg"`
	RefreshSeconds         int               `json:"refreshSeconds"`
	WorkflowRepoCap        int               `json:"workflowRepoCap"`
	Probes                 []ProbeConfig     `json:"probes"`
	RepoDomains            map[string]string `json:"repoDomains,omitempty"`
	TypeSafeAuto           bool              `json:"typeSafeAuto"`
	TypeSafeMinIntervalSec int               `json:"typeSafeMinIntervalSec"`
	TypeSafeDailyBudget    int               `json:"typeSafeDailyBudget"`
	WorksEnabled           bool              `json:"worksEnabled"`
	WorksURL               string            `json:"worksUrl,omitempty"`
	AgentStaleSeconds      int               `json:"agentStaleSeconds"`
	AssistantLocalModel    bool              `json:"assistantLocalModel"`
	AssistantOllamaURL     string            `json:"assistantOllamaUrl,omitempty"`
	AssistantModel         string            `json:"assistantModel,omitempty"`
}

type DomainSummary struct {
	Name         string `json:"name"`
	RepoCount    int    `json:"repoCount"`
	PrivateRepos int    `json:"privateRepos"`
	PublicRepos  int    `json:"publicRepos"`
	OpenIssues   int    `json:"openIssues"`
	CIHealthy    int    `json:"ciHealthy"`
	CIFailing    int    `json:"ciFailing"`
	Activity24h  int    `json:"activity24h"`
	Status       string `json:"status"`
}

type HostTelemetry struct {
	Hostname    string    `json:"hostname"`
	OS          string    `json:"os"`
	Arch        string    `json:"arch"`
	CPUPercent  float64   `json:"cpuPercent"`
	MemoryUsed  float64   `json:"memoryUsedPercent"`
	MemoryTotal uint64    `json:"memoryTotalBytes"`
	MemoryFree  uint64    `json:"memoryFreeBytes"`
	DiskUsed    float64   `json:"diskUsedPercent"`
	DiskTotal   uint64    `json:"diskTotalBytes"`
	DiskFree    uint64    `json:"diskFreeBytes"`
	GoHeapBytes uint64    `json:"goHeapBytes"`
	ObservedAt  time.Time `json:"observedAt"`
	Source      string    `json:"source"`
	Error       string    `json:"error,omitempty"`
}

type AgentSession struct {
	ID            string            `json:"id"`
	Sequence      uint64            `json:"sequence,omitempty"`
	Name          string            `json:"name"`
	Kind          string            `json:"kind"`
	Provider      string            `json:"provider"`
	Node          string            `json:"node,omitempty"`
	Repo          string            `json:"repo,omitempty"`
	MissionID     string            `json:"missionId,omitempty"`
	WorkID        string            `json:"workId,omitempty"`
	State         string            `json:"state"`
	CurrentAction string            `json:"currentAction,omitempty"`
	Progress      float64           `json:"progress,omitempty"`
	Model         string            `json:"model,omitempty"`
	Capabilities  []string          `json:"capabilities,omitempty"`
	StartedAt     time.Time         `json:"startedAt,omitempty"`
	LastHeartbeat time.Time         `json:"lastHeartbeat"`
	Source        string            `json:"source"`
	URL           string            `json:"url,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type AgentEvent struct {
	ID        string            `json:"id"`
	AgentID   string            `json:"agentId,omitempty"`
	Kind      string            `json:"kind"`
	Title     string            `json:"title"`
	State     string            `json:"state,omitempty"`
	Repo      string            `json:"repo,omitempty"`
	MissionID string            `json:"missionId,omitempty"`
	WorkID    string            `json:"workId,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
	Source    string            `json:"source"`
	URL       string            `json:"url,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type AgentSourceStatus struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Kind           string    `json:"kind"`
	URL            string    `json:"url,omitempty"`
	Status         string    `json:"status"`
	LastObservedAt time.Time `json:"lastObservedAt,omitempty"`
	Error          string    `json:"error,omitempty"`
}

type AgentSnapshot struct {
	ObservedAt time.Time           `json:"observedAt"`
	Sessions   []AgentSession      `json:"sessions"`
	Events     []AgentEvent        `json:"events"`
	Sources    []AgentSourceStatus `json:"sources"`
	Active     int                 `json:"active"`
	Running    int                 `json:"running"`
	Waiting    int                 `json:"waiting"`
	Blocked    int                 `json:"blocked"`
	Stale      int                 `json:"stale"`
}

type AssistantStatus struct {
	Mode                string    `json:"mode"`
	GroundedCore        bool      `json:"groundedCore"`
	LocalModelAvailable bool      `json:"localModelAvailable"`
	LocalModel          string    `json:"localModel,omitempty"`
	OllamaURL           string    `json:"ollamaUrl,omitempty"`
	CheckedAt           time.Time `json:"checkedAt"`
	Error               string    `json:"error,omitempty"`
}

type AssistantObject struct {
	Type     string            `json:"type"`
	ID       string            `json:"id,omitempty"`
	Title    string            `json:"title"`
	Subtitle string            `json:"subtitle,omitempty"`
	Status   string            `json:"status,omitempty"`
	URL      string            `json:"url,omitempty"`
	Fields   map[string]string `json:"fields,omitempty"`
}

type AssistantAction struct {
	Label  string `json:"label"`
	Kind   string `json:"kind"`
	Target string `json:"target"`
}

type AssistantResponse struct {
	ID          string            `json:"id"`
	Answer      string            `json:"answer"`
	Mode        string            `json:"mode"`
	Confidence  float64           `json:"confidence"`
	Sources     []string          `json:"sources"`
	Objects     []AssistantObject `json:"objects,omitempty"`
	Actions     []AssistantAction `json:"actions,omitempty"`
	Caveats     []string          `json:"caveats,omitempty"`
	GeneratedAt time.Time         `json:"generatedAt"`
}

type Summary struct {
	Now             time.Time           `json:"now"`
	StartedAt       time.Time           `json:"startedAt"`
	Version         string              `json:"version"`
	GitHub          GitHubSnapshot      `json:"github"`
	Domains         []DomainSummary     `json:"domains"`
	Metrics         []MetricSample      `json:"metrics"`
	Probes          []ProbeResult       `json:"probes"`
	Host            HostTelemetry       `json:"host"`
	NeedsYou        int                 `json:"needsYou"`
	ConnectionState string              `json:"connectionState"`
	Intelligence    IntelligenceSummary `json:"intelligence"`
	TypeSafe        TypeSafeDecision    `json:"typeSafe"`
	Agents          AgentSnapshot       `json:"agents"`
	Assistant       AssistantStatus     `json:"assistant"`
}
