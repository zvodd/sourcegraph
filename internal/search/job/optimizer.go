package job

func ZoektAnd(children []Job) []Job {
	return []Job{children[0]}
}

func OptimizeAnd(job Job) Job {
	return (&Mapper{MapAndJob: ZoektAnd}).Map(job)
}
