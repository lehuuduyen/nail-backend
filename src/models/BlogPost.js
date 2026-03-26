const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BlogPost = sequelize.define(
    'BlogPost',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      slug: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
      title: { type: DataTypes.STRING(220), allowNull: false },
      metaTitle: { type: DataTypes.STRING(220), allowNull: true },
      excerpt: { type: DataTypes.TEXT, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      metaDescription: { type: DataTypes.STRING(320), allowNull: false },
      /** Optional FAQ items for FAQPage JSON-LD: [{ q, a }, ...] */
      faqs: { type: DataTypes.JSON, allowNull: true },
      keywords: { type: DataTypes.STRING(500), allowNull: true },
      published: { type: DataTypes.BOOLEAN, defaultValue: true },
      publishedAt: { type: DataTypes.DATE, allowNull: false },
      readingMinutes: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 5 },
    },
    {
      tableName: 'blog_posts',
      timestamps: true,
    }
  );
  return BlogPost;
};
