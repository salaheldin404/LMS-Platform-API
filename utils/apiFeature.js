class ApiFeatures {
  constructor(query, req) {
    if (!query || !req) {
      throw new Error("Query and request objects are required");
    }
    this.query = query;
    this.queryParams = { ...req.query };
    this.pagination = {};
  }

  filter() {
    const queryObj = { ...this.queryParams };
    const excludedFields = ["page", "sort", "limit", "fields", "search"];
    excludedFields.forEach((el) => delete queryObj[el]);
    const filterObj = {};

    // Helper function to process array or single value
    const toArray = (value) => {
      if (Array.isArray(value)) return value;
      return [value];
    };
    // handle category filter
    // Filter by category (categories is an array in the schema)
    if (queryObj.category) {
      console.log(queryObj.category, "category");
      filterObj.category = { $in: toArray(queryObj.category) };
    }

    if (queryObj.level) {
      filterObj.level = { $in: toArray(queryObj.level) };
    }

    console.log("Server - Received query params:", queryObj);
    console.log("Server - Processed filter object:", filterObj);
    console.log("server- this.queryParams ", this.queryParams);

    // handle price range
    if (queryObj.minPrice || queryObj.maxPrice) {
      filterObj.price = {};
      if (queryObj.minPrice) {
        filterObj.price.$gte = parseFloat(queryObj.minPrice);
      }
      if (queryObj.maxPrice) {
        filterObj.price.$lte = parseFloat(queryObj.maxPrice);
      }
    }

    // handle rating
    if (queryObj.minRating || queryObj.maxRating) {
      filterObj["ratingsSummary.averageRating"] = {};
      if (queryObj.minRating) {
        filterObj["ratingsSummary.averageRating"].$gte =
          Number(queryObj.minRating) || 0;
      }
      if (queryObj.maxRating) {
        filterObj["ratingsSummary.averageRating"].$lte = Number(
          queryObj.maxRating
        );
      }
    }

    this.query = this.query.find(filterObj);
    return this;
  }

  search(searchFields = ["title", "description"]) {
    if (this.queryParams.search) {
      const searchTerm = this.queryParams.search.trim();
      if (!searchTerm) return this;
      const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      const searchConditions = searchFields.map((field) => ({
        [field]: searchRegex,
      }));

      this.query = this.query.and([{ $or: searchConditions }]);
    }
    return this;
  }

  sort(defaultSort = "-createdAt") {
    const sortMap = {
      "price-low": "price",
      "price-high": "-price",
      "highest-rating": "-ratingsSummary.averageRating",
      popularity: "-ratingsSummary.totalRatings",
      newest: defaultSort,
    };

    const sortBy = sortMap[this.queryParams.sort] || defaultSort;
    this.query = this.query.sort(sortBy);

    return this;
  }

  paginate(defaultLimit = 10) {
    const page = Math.max(1, parseInt(this.queryParams.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(this.queryParams.limit, 10) || defaultLimit, 1),
      100
    );

    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    this.pagination = {
      currentPage: page,
      limit,
    };

    return this;
  }

  limitFields() {
    if (this.queryParams.fields) {
      const fields = this.queryParams.fields
        .split(",")
        .map((field) => field.trim())
        .filter((field) => field)
        .join(" ");
      this.query = this.query.select(fields);
    }
    return this;
  }

  async getResults() {
    const countQuery = this.query.model.find(this.query.getFilter());

    const [totalDocuments, results] = await Promise.all([
      countQuery.countDocuments(),
      this.query.exec(),
    ]);

    const limit = this.pagination.limit || 10;
    const totalPages = Math.ceil(totalDocuments / limit);
    const data = {
      results,
      pagination: {
        currentPage: this.pagination.currentPage || 1,
        limit,
        totalPages,
        totalDocuments,
      },
    };
    return data;
  }
}

export default ApiFeatures;
