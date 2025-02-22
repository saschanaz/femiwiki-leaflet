export class MediaWikiClient {
  /**
   * @param {string} apiBase
   * @param {string} bearer
   */
  constructor(apiBase, bearer) {
    this.apiBase = apiBase;

    if (!bearer) {
      throw new Error("No bearer token");
    }
    this.bearer = bearer;
  }

  /**
   * @param {string} method
   * @param {string} endpoint
   * @param {object} params
   * @returns {Promise<object>}
   */
  async request(method, endpoint, params) {
    const { ok, data } = await this.tryRequest(method, endpoint, params);
    if (!ok) {
      throw new Error(`Request to ${endpoint} failed`, { cause: data });
    }
    return data;
  }

  /**
   * @param {string} method
   * @param {string} endpoint
   * @param {object} params
   * @returns {Promise<object>}
   */
  async tryRequest(method, endpoint, params) {
    const res = await fetch(new URL(endpoint, this.apiBase), {
      method,
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.bearer}`,
      },
    });
    return { ok: res.ok, data: await res.json() };
  }

  /**
   * @param {string} method
   * @param {string} action
   * @param {object} params
   * @returns {Promise<object>}
   */
  async tryRequestAction(action, params) {
    const url = new URL(this.apiBase);
    url.searchParams.set("format", "json");
    url.searchParams.set("action", action);
    const body= new URLSearchParams(params).toString()
    const res = await fetch(url, {
      method: "post",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${this.bearer}`,
      },
    });
    const result = await res.json();
    return result;
  }

  /**
   * @param {string} title
   * @param {object} params
   * @param {string} params.source
   * @param {string?} params.comment
   * @param {object} params.latest
   * @param {number} params.latest.id
   *
   * @returns {Promise<object>}
   */
  async edit(title, params) {
    return await this.request(
      "PUT",
      `v1/page/${encodeURIComponent(title)}`,
      params
    );
  }

  /** @param {string} title */
  async tryGet(title) {
    let target = `v1/page/${encodeURIComponent(title)}`;
    while (target) {
      const result = await this.tryRequest("GET", target);
      if (!result.ok || !result.data.redirect_target) {
        return result;
      }
      console.log(`(Redirecting to ${result.data.redirect_target})`);
      target = new URL(
        result.data.redirect_target,
        new URL(this.apiBase).origin
      );
    }
  }
}
