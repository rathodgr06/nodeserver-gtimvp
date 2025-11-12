class DBQuery {
  constructor() {
    this.queryBuilder = pool.get_connection();
  }

  // constructor(dbQuery) {
  //   this = dbQuery;
  // }

  setSelect(select) {
    this.queryBuilder.select(select);
    return this;
  }

  setFrom(from) {
    this.queryBuilder.from(from);
    return this;
  }

  setWhere(where) {
    this.queryBuilder.where(where);
    return this;
  }

  setLimit(limit) {
    this.queryBuilder.limit(limit);
    return this;
  }

  setLike(like) {
    this.queryBuilder.like(like);
    return this;
  }

  setGroupBy(group_by) {
    this.queryBuilder.group_by(group_by);
    return this;
  }

  async run() {
    return this.queryBuilder.get(this.queryBuilder.from);
  }
}
