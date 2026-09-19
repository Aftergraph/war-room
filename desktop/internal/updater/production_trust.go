package updater

// ProductionTrustStore is compiled into the updater binary. Update callers cannot
// replace this trust root at runtime. A governed release must add the approved
// Aftergraph desktop release public key here before automatic updates can apply.
func ProductionTrustStore() TrustStore {
	return TrustStore{
		Schema: TrustSchema,
		Keys:   []TrustedKey{},
	}
}
