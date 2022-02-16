package job

func ZoektAnd(children []Job) []Job {
	return []Job{}
}

func OptimizeAnd(job Job) Job {
	return (&Mapper{MapAndJob: ZoektAnd}).Map(job)
}
