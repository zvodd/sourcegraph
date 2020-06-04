BEGIN;

-- At first, we'll only store the last commit from each branch in a repo.
CREATE TABLE git_commits (
  repo_id int NOT NULL REFERENCES repo(id),
  sha text,  -- e.g. 7fd1a60b01f91b314f59955a4e4d4e80d8edf11d
  message text NOT NULL,
  refs text[] NOT NULL,  -- e.g. [master, develop]
  author_date timestamptz NOT NULL,
  author_name text NOT NULL,
  author_email text NOT NULL,
  committer_date timestamptz,
  committer_name text,
  committer_email text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz,
  PRIMARY KEY (repo_id, sha)
);

CREATE INDEX git_commits_refs ON git_commits (refs);
CREATE INDEX git_commits_committer_date ON git_commits (committer_date);

COMMIT;
