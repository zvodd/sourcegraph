package run

import (
	"testing"

	"github.com/hexops/autogold"
)

func TestMap(t *testing.T) {
	test := func(job Job, mapper Mapper) string {
		return PrettyPrint(mapper.Map(job))
	}

	andMapper := Mapper{
		MapAndJob: func(children []Job) []Job {
			return append(children, NewOrJob(NewNoopJob(), NewNoopJob()))
		},
	}
	autogold.Want("basic and-job mapper", "(and NoopJob NoopJob (or NoopJob NoopJob))").Equal(t, test(NewAndJob(NewNoopJob(), NewNoopJob()), andMapper))
}
